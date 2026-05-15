const { db } = require('../db')
const { ahora } = require('../utils/fecha')

const getAll = (req, res) => {
  try {
    const productos = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ORDER BY p.nombre
    `).all()
    res.json(productos)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getById = (req, res) => {
  try {
    const producto = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `).get(req.params.id)
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(producto)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getByCodigoBarras = (req, res) => {
  try {
    const producto = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.codigo_barras = ? AND p.activo = 1
    `).get(req.params.codigo)
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(producto)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getLowStock = (req, res) => {
  try {
    const productos = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.stock <= p.stock_minimo AND p.activo = 1
      ORDER BY p.stock ASC
    `).all()
    res.json(productos)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const {
    nombre, codigo_barras, precio_compra, precio_venta,
    stock, stock_minimo, categoria_id, tasa_iva
  } = req.body

  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!precio_venta) return res.status(400).json({ error: 'El precio de venta es obligatorio' })

  try {
    const result = db.prepare(`
      INSERT INTO productos
        (nombre, codigo_barras, precio_compra, precio_venta, stock, stock_minimo, categoria_id, tasa_iva, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre.trim(),
      codigo_barras || null,
      precio_compra || 0,
      precio_venta,
      stock || 0,
      stock_minimo || 5,
      categoria_id || null,
      tasa_iva ?? 10,
      ahora()
    )
    res.status(201).json({ id: result.lastInsertRowid, ...req.body })
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' })
    }
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const {
    nombre, codigo_barras, precio_compra, precio_venta,
    stock_minimo, categoria_id, tasa_iva
  } = req.body

  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!precio_venta) return res.status(400).json({ error: 'El precio de venta es obligatorio' })

  try {
    const result = db.prepare(`
      UPDATE productos SET
        nombre = ?, codigo_barras = ?, precio_compra = ?,
        precio_venta = ?, stock_minimo = ?, categoria_id = ?, tasa_iva = ?
      WHERE id = ?
    `).run(
      nombre.trim(),
      codigo_barras || null,
      precio_compra || 0,
      precio_venta,
      stock_minimo || 5,
      categoria_id || null,
      tasa_iva ?? 10,
      req.params.id
    )
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ id: Number(req.params.id), ...req.body })
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' })
    }
    res.status(500).json({ error: err.message })
  }
}

// Soft delete — nunca borramos productos reales, afectan historial
const remove = (req, res) => {
  try {
    const result = db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ mensaje: 'Producto desactivado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getByCodigoBarras, getLowStock, create, update, remove }