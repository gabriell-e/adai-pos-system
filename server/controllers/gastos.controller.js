const { db } = require('../db')
const { ahora } = require('../utils/fecha')

const CATEGORIAS = [
  'Alquiler', 'Comida', 'Transporte', 'Servicios',
  'Salud', 'Educación', 'Personal', 'Otros'
]

// ─── LISTAR ────────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, categoria, estado } = req.query

    let sql = `
      SELECT g.*, u.nombre AS usuario_nombre, ua.nombre AS anulado_por_nombre
      FROM gastos g
      LEFT JOIN usuarios u  ON g.usuario_id  = u.id
      LEFT JOIN usuarios ua ON g.anulado_por = ua.id
      WHERE 1=1
    `
    const params = []

    if (fecha_desde) { sql += ' AND date(g.creado_en) >= ?'; params.push(fecha_desde) }
    if (fecha_hasta) { sql += ' AND date(g.creado_en) <= ?'; params.push(fecha_hasta) }
    if (categoria)   { sql += ' AND g.categoria = ?';        params.push(categoria) }
    if (estado)      { sql += ' AND g.estado = ?';           params.push(estado) }

    sql += ' ORDER BY g.creado_en DESC, g.id DESC'

    const gastos = db.prepare(sql).all(...params)

    const registrados = gastos.filter(g => g.estado === 'registrado')
    const resumen = {
      total_gastos:   registrados.reduce((a, g) => a + g.monto, 0),
      cantidad:       registrados.length,
      anulados:       gastos.filter(g => g.estado === 'anulado').length,
      monto_anulado:  gastos.filter(g => g.estado === 'anulado').reduce((a, g) => a + g.monto, 0),
      por_categoria:  {}
    }

    for (const g of registrados) {
      const cat = g.categoria || 'Otros'
      if (!resumen.por_categoria[cat]) resumen.por_categoria[cat] = { cantidad: 0, total: 0 }
      resumen.por_categoria[cat].cantidad++
      resumen.por_categoria[cat].total += g.monto
    }

    res.json({ gastos, resumen, categorias: CATEGORIAS })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── RESUMEN ───────────────────────────────────────────────────────────────
const getResumen = (req, res) => {
  try {
    const hoy      = new Date().toLocaleDateString('sv-SE')
    const mes      = hoy.slice(0, 7)

    const hoy_  = db.prepare(`
      SELECT COALESCE(SUM(monto),0) total, COUNT(*) cantidad
      FROM gastos WHERE estado = 'registrado' AND date(creado_en) = ?
    `).get(hoy)
    const mes_  = db.prepare(`
      SELECT COALESCE(SUM(monto),0) total, COUNT(*) cantidad
      FROM gastos WHERE estado = 'registrado' AND substr(creado_en,1,7) = ?
    `).get(mes)

    res.json({ hoy: hoy_, mes: mes_ })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CREAR ─────────────────────────────────────────────────────────────────
const crear = (req, res) => {
  const { descripcion, monto, categoria } = req.body || {}

  if (!descripcion || !descripcion.trim())
    return res.status(400).json({ error: 'La descripción es obligatoria' })

  const valor = Number(monto)
  if (!valor || valor <= 0)
    return res.status(400).json({ error: 'El monto debe ser mayor a cero' })

  if (categoria && !CATEGORIAS.includes(categoria))
    return res.status(400).json({ error: `Categoría inválida. Opciones: ${CATEGORIAS.join(', ')}` })

  try {
    const result = db.prepare(`
      INSERT INTO gastos (usuario_id, descripcion, monto, categoria, creado_en)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.usuario?.id || null, descripcion.trim(), valor, categoria || 'Otros', ahora())

    res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Gasto registrado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── ANULAR ────────────────────────────────────────────────────────────────
// No se borra: queda el rastro del movimiento de plata.
const anular = (req, res) => {
  const { motivo } = req.body || {}

  try {
    const gasto = db.prepare("SELECT * FROM gastos WHERE id = ? AND estado = 'registrado'").get(req.params.id)
    if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado o ya anulado' })

    db.prepare(`
      UPDATE gastos
      SET estado = 'anulado', anulado_por = ?, anulado_en = ?, motivo_anulacion = ?
      WHERE id = ?
    `).run(req.usuario?.id || null, ahora(), motivo || null, req.params.id)

    res.json({ mensaje: 'Gasto anulado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── TOTAL PARA CIERRE DE CAJA ─────────────────────────────────────────────
// Todo gasto registrado descuenta del efectivo de la caja.
const totalEnPeriodo = (desde, hasta = null) => db.prepare(`
  SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad
  FROM gastos
  WHERE estado = 'registrado'
    AND creado_en >= ?
    AND creado_en <= COALESCE(?, datetime('now', 'localtime'))
`).get(desde, hasta)

module.exports = { getAll, getResumen, crear, anular, totalEnPeriodo, CATEGORIAS }
