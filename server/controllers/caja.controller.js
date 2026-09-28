const { db } = require('../db')
const { ahora } = require('../utils/fecha')

// Efectivo real que entró a la gaveta en un rango de tiempo.
// Las ventas mixtas guardan el detalle en JSON, así que hay que sumar
// solo la parte en efectivo; si no, el cierre siempre da faltante.
const SQL_EFECTIVO = `
  SELECT COALESCE(SUM(CASE
    WHEN v.tipo_pago = 'efectivo' THEN v.total
    WHEN v.tipo_pago = 'mixto' AND v.pago_detalle IS NOT NULL THEN
      COALESCE((
        SELECT SUM(CAST(json_extract(j.value, '$.monto') AS REAL))
        FROM json_each(v.pago_detalle) j
        WHERE json_extract(j.value, '$.tipo') = 'efectivo'
      ), 0)
    ELSE 0
  END), 0) AS total
  FROM ventas v
  WHERE v.creado_en BETWEEN ? AND COALESCE(?, datetime('now', 'localtime'))
    AND v.estado = 'completada'
`

const totalEfectivo = (desde, hasta = null) =>
  db.prepare(SQL_EFECTIVO).get(desde, hasta).total

// ─── GET ALL ─────────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  try {
    const cajas = db.prepare(`
      SELECT c.*, u.nombre AS usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.abierta_en DESC
    `).all()
    res.json(cajas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── GET BY ID ───────────────────────────────────────────────────────────────
const getById = (req, res) => {
  try {
    const caja = db.prepare(`
      SELECT c.*, u.nombre AS usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = ?
    `).get(req.params.id)

    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' })

    // Ventas realizadas durante esta sesión de caja
    const ventas = db.prepare(`
      SELECT
        v.id, v.numero_factura, v.tipo_pago, v.total,
        v.estado, v.creado_en,
        c.nombre AS cliente_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.creado_en BETWEEN ? AND COALESCE(?, datetime('now', 'localtime'))
        AND v.estado = 'completada'
      ORDER BY v.creado_en DESC
    `).all(caja.abierta_en, caja.cerrada_en)

    // Resumen por tipo de pago
    const resumen = db.prepare(`
      SELECT
        tipo_pago,
        COUNT(*)   AS cantidad,
        SUM(total) AS total
      FROM ventas
      WHERE creado_en BETWEEN ? AND COALESCE(?, datetime('now', 'localtime'))
        AND estado = 'completada'
      GROUP BY tipo_pago
    `).all(caja.abierta_en, caja.cerrada_en)

    const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0)

    // Gastos personales del período de esta caja
    const gastos = db.prepare(`
      SELECT g.*, u.nombre AS usuario_nombre
      FROM gastos g
      LEFT JOIN usuarios u ON g.usuario_id = u.id
      WHERE g.creado_en >= ? AND g.creado_en <= COALESCE(?, datetime('now', 'localtime'))
      ORDER BY g.creado_en DESC
    `).all(caja.abierta_en, caja.cerrada_en)

    const totalGastos = gastos
      .filter(g => g.estado === 'registrado')
      .reduce((acc, g) => acc + g.monto, 0)

    const efectivoCaja = totalEfectivo(caja.abierta_en, caja.cerrada_en)

    res.json({
      ...caja,
      ventas,
      resumen,
      gastos,
      total_gastos:  Math.round(totalGastos),
      esperado:      Math.round(caja.monto_inicial + efectivoCaja - totalGastos),
      total_ventas:  Math.round(totalVentas)
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CAJA ACTIVA ─────────────────────────────────────────────────────────────
const getActiva = (req, res) => {
  try {
    const caja = db.prepare(`
      SELECT c.*, u.nombre AS usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.estado = 'abierta'
      ORDER BY c.abierta_en DESC
      LIMIT 1
    `).get()

    if (!caja) return res.status(404).json({ error: 'No hay caja abierta' })
    res.json(caja)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── ABRIR CAJA ──────────────────────────────────────────────────────────────
const abrir = (req, res) => {
  const { usuario_id, monto_inicial } = req.body

  if (!usuario_id)    return res.status(400).json({ error: 'El usuario es obligatorio' })
  if (monto_inicial === undefined || monto_inicial === null)
    return res.status(400).json({ error: 'El monto inicial es obligatorio' })
  if (monto_inicial < 0)
    return res.status(400).json({ error: 'El monto inicial no puede ser negativo' })

  try {
    const cajaAbierta = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get()
    if (cajaAbierta)
      return res.status(409).json({ error: 'Ya hay una caja abierta' })

    const result = db.prepare(`
      INSERT INTO caja (usuario_id, monto_inicial, abierta_en, estado)
      VALUES (?, ?, ?, 'abierta')
    `).run(usuario_id, monto_inicial, ahora())

    res.status(201).json({
      id:            result.lastInsertRowid,
      mensaje:       'Caja abierta correctamente',
      monto_inicial,
      abierta_en:    ahora()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CERRAR CAJA ─────────────────────────────────────────────────────────────
const cerrar = (req, res) => {
  const { monto_final } = req.body
  if (monto_final === undefined || monto_final === null)
    return res.status(400).json({ error: 'El monto final es obligatorio' })

  try {
    const caja = db.prepare('SELECT * FROM caja WHERE id = ?').get(req.params.id)
    if (!caja)                   return res.status(404).json({ error: 'Caja no encontrada' })
    if (caja.estado === 'cerrada') return res.status(409).json({ error: 'La caja ya está cerrada' })

    const cerrada_en = ahora()

    // Total ventas del día
    const totalVentas = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM ventas
      WHERE creado_en >= ? AND estado = 'completada'
    `).get(caja.abierta_en).total

    // Total efectivo que entró a la gaveta (incluye la parte en efectivo de las mixtas)
    const efectivoCaja = totalEfectivo(caja.abierta_en, cerrada_en)

    // Costo real de lo vendido (ganancia bruta)
    const costoVendido = db.prepare(`
      SELECT COALESCE(SUM(dv.precio_compra_unitario * dv.cantidad), 0) AS total
      FROM detalle_venta dv
      JOIN ventas v ON dv.venta_id = v.id
      WHERE v.creado_en >= ? AND v.estado = 'completada'
    `).get(caja.abierta_en).total

    const ganancia    = Math.round(totalVentas - costoVendido)

    // Gastos personales: también salen del efectivo de la caja
    const gastos = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad
      FROM gastos
      WHERE estado = 'registrado' AND creado_en >= ?
    `).get(caja.abierta_en)

    const esperado = Math.round(caja.monto_inicial + efectivoCaja - gastos.total)
    const diferencia  = Math.round(monto_final - esperado)

    db.prepare(`
      UPDATE caja SET monto_final = ?, cerrada_en = ?, estado = 'cerrada', total_gastos = ?
      WHERE id = ?
    `).run(monto_final, cerrada_en, gastos.total, req.params.id)

    res.json({
      mensaje:         'Caja cerrada correctamente',
      monto_inicial:   caja.monto_inicial,
      total_ventas:    Math.round(totalVentas),
      total_efectivo:  Math.round(efectivoCaja),
      costo_vendido:   Math.round(costoVendido),
      ganancia_bruta:  ganancia,
      total_gastos:    Math.round(gastos.total),
      cantidad_gastos: gastos.cantidad,
      esperado,
      monto_final,
      diferencia,
      cerrada_en
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getActiva, abrir, cerrar }