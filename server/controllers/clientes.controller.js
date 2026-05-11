const { db } = require('../db')

const getAll = (req, res) => {
  try {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nombre').all()
    res.json(clientes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getById = (req, res) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id)
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(cliente)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getHistorial = (req, res) => {
  try {
    const ventas = db.prepare(`
      SELECT v.id, v.numero_factura, v.total, v.tipo_pago,
             v.condicion_venta, v.estado, v.creado_en
      FROM ventas v
      WHERE v.cliente_id = ?
      ORDER BY v.creado_en DESC
    `).all(req.params.id)
    res.json(ventas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const { nombre, ruc_ci, telefono, email } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare(`
      INSERT INTO clientes (nombre, ruc_ci, telefono, email)
      VALUES (?, ?, ?, ?)
    `).run(nombre.trim(), ruc_ci || null, telefono || null, email || null)
    res.status(201).json({ id: result.lastInsertRowid, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const { nombre, ruc_ci, telefono, email } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare(`
      UPDATE clientes SET nombre = ?, ruc_ci = ?, telefono = ?, email = ?
      WHERE id = ?
    `).run(nombre.trim(), ruc_ci || null, telefono || null, email || null, req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json({ id: Number(req.params.id), ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const remove = (req, res) => {
  try {
    const ventas = db.prepare('SELECT COUNT(*) as total FROM ventas WHERE cliente_id = ?').get(req.params.id)
    if (ventas.total > 0) {
      return res.status(409).json({ error: 'No se puede eliminar, tiene ventas asociadas' })
    }
    const result = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json({ mensaje: 'Cliente eliminado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getHistorial, create, update, remove }