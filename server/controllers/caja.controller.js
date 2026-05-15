const { db } = require('../db')
const { ahora } = require('../utils/fecha')

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

    res.json({ ...caja, ventas, resumen, total_ventas: totalVentas })
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
    const caja = db.prepare("SELECT * FROM caja WHERE id = ?").get(req.params.id)
    if (!caja)              return res.status(404).json({ error: 'Caja no encontrada' })
    if (caja.estado === 'cerrada') return res.status(409).json({ error: 'La caja ya está cerrada' })

    // Total de ventas en efectivo durante esta sesión
    const totalEfectivo = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM ventas
      WHERE creado_en >= ?
        AND tipo_pago = 'efectivo'
        AND estado = 'completada'
    `).get(caja.abierta_en).total

    const cerrada_en    = ahora()
    const diferencia    = monto_final - (caja.monto_inicial + totalEfectivo)

    db.prepare(`
      UPDATE caja SET monto_final = ?, cerrada_en = ?, estado = 'cerrada'
      WHERE id = ?
    `).run(monto_final, cerrada_en, req.params.id)

    res.json({
      mensaje:         'Caja cerrada correctamente',
      monto_inicial:   caja.monto_inicial,
      total_efectivo:  totalEfectivo,
      esperado:        caja.monto_inicial + totalEfectivo,
      monto_final,
      diferencia,
      cerrada_en
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getActiva, abrir, cerrar }