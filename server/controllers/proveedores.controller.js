const { db } = require('../db')

const getAll = (req, res) => {
  try {
    const proveedores = db.prepare('SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre').all()
    res.json(proveedores)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getById = (req, res) => {
  try {
    const proveedor = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(req.params.id)
    if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json(proveedor)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getHistorial = (req, res) => {
  try {
    const compras = db.prepare(`
      SELECT c.id, c.numero_factura_proveedor, c.total, c.estado, c.creado_en
      FROM compras c
      WHERE c.proveedor_id = ?
      ORDER BY c.creado_en DESC
    `).all(req.params.id)
    res.json(compras)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const { nombre, ruc, telefono, email } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare(`
      INSERT INTO proveedores (nombre, ruc, telefono, email)
      VALUES (?, ?, ?, ?)
    `).run(nombre.trim(), ruc || null, telefono || null, email || null)
    res.status(201).json({ id: result.lastInsertRowid, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const { nombre, ruc, telefono, email } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare(`
      UPDATE proveedores SET nombre = ?, ruc = ?, telefono = ?, email = ?
      WHERE id = ?
    `).run(nombre.trim(), ruc || null, telefono || null, email || null, req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json({ id: Number(req.params.id), ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const remove = (req, res) => {
  try {
    const compras = db.prepare('SELECT COUNT(*) as total FROM compras WHERE proveedor_id = ?').get(req.params.id)
    if (compras.total > 0) {
      return res.status(409).json({ error: 'No se puede eliminar, tiene compras asociadas' })
    }
    const result = db.prepare('UPDATE proveedores SET activo = 0 WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Proveedor no encontrado' })
    res.json({ mensaje: 'Proveedor desactivado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getHistorial, create, update, remove }