const { db } = require('../db')
const { ahora } = require('../utils/fecha')

const getAll = (req, res) => {
  try {
    const categorias = db.prepare('SELECT * FROM categorias ORDER BY nombre').all()
    res.json(categorias)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getById = (req, res) => {
  try {
    const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id)
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' })
    res.json(categoria)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const { nombre } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare('INSERT INTO categorias (nombre, creado_en) VALUES (?, ?)').run(nombre.trim(), ahora())
    res.status(201).json({ id: result.lastInsertRowid, nombre: nombre.trim() })
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' })
    }
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const { nombre } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare('UPDATE categorias SET nombre = ? WHERE id = ?').run(nombre.trim(), req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' })
    res.json({ id: Number(req.params.id), nombre: nombre.trim() })
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' })
    }
    res.status(500).json({ error: err.message })
  }
}

const remove = (req, res) => {
  try {
    // Verificar si tiene productos asociados
    const productos = db.prepare('SELECT COUNT(*) as total FROM productos WHERE categoria_id = ?').get(req.params.id)
    if (productos.total > 0) {
      return res.status(409).json({ error: 'No se puede eliminar, tiene productos asociados' })
    }

    const result = db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' })
    res.json({ mensaje: 'Categoría eliminada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, create, update, remove }