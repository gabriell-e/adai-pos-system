const { db } = require('../db')

const getAllByProduct = (req, res) => {
  try {
    const presentaciones = db.prepare(`
      SELECT * FROM presentaciones_producto
      WHERE producto_id = ?
      ORDER BY unidades_por_paquete ASC
    `).all(req.params.productoId)
    res.json(presentaciones)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const {
    nombre, unidades_por_paquete, precio_venta, precio_compra,
    codigo_barras, es_venta_defecto, es_compra_defecto
  } = req.body

  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!unidades_por_paquete || unidades_por_paquete <= 0)
    return res.status(400).json({ error: 'unidades_por_paquete debe ser mayor a 0' })

  try {
    const producto = db.prepare('SELECT id FROM productos WHERE id = ?').get(req.params.productoId)
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })

    const insertar = db.transaction(() => {
      if (es_venta_defecto) {
        db.prepare('UPDATE presentaciones_producto SET es_venta_defecto = 0 WHERE producto_id = ?')
          .run(req.params.productoId)
      }
      if (es_compra_defecto) {
        db.prepare('UPDATE presentaciones_producto SET es_compra_defecto = 0 WHERE producto_id = ?')
          .run(req.params.productoId)
      }

      const result = db.prepare(`
        INSERT INTO presentaciones_producto
          (producto_id, nombre, unidades_por_paquete, precio_venta, precio_compra,
           codigo_barras, es_venta_defecto, es_compra_defecto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.params.productoId, nombre.trim(),
        unidades_por_paquete, precio_venta || 0, precio_compra || 0,
        codigo_barras || null,
        es_venta_defecto ? 1 : 0,
        es_compra_defecto ? 1 : 0
      )

      return result.lastInsertRowid
    })

    const id = insertar()
    res.status(201).json({ id, mensaje: 'Presentación creada' })
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ya existe una presentación con ese código de barras' })
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const {
    nombre, unidades_por_paquete, precio_venta, precio_compra,
    codigo_barras, es_venta_defecto, es_compra_defecto
  } = req.body

  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const presentacion = db.prepare(`
      SELECT * FROM presentaciones_producto WHERE id = ? AND producto_id = ?
    `).get(req.params.id, req.params.productoId)
    if (!presentacion) return res.status(404).json({ error: 'Presentación no encontrada' })

    db.transaction(() => {
      if (es_venta_defecto) {
        db.prepare('UPDATE presentaciones_producto SET es_venta_defecto = 0 WHERE producto_id = ?')
          .run(req.params.productoId)
      }
      if (es_compra_defecto) {
        db.prepare('UPDATE presentaciones_producto SET es_compra_defecto = 0 WHERE producto_id = ?')
          .run(req.params.productoId)
      }

      db.prepare(`
        UPDATE presentaciones_producto SET
          nombre = ?, unidades_por_paquete = ?, precio_venta = ?,
          precio_compra = ?, codigo_barras = ?,
          es_venta_defecto = ?, es_compra_defecto = ?
        WHERE id = ? AND producto_id = ?
      `).run(
        nombre.trim(),
        unidades_por_paquete ?? presentacion.unidades_por_paquete,
        precio_venta ?? presentacion.precio_venta,
        precio_compra ?? presentacion.precio_compra,
        codigo_barras ?? presentacion.codigo_barras,
        es_venta_defecto ? 1 : 0,
        es_compra_defecto ? 1 : 0,
        req.params.id,
        req.params.productoId
      )
    })()

    res.json({ mensaje: 'Presentación actualizada' })
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ya existe una presentación con ese código de barras' })
    res.status(500).json({ error: err.message })
  }
}

const remove = (req, res) => {
  try {
    const presentacion = db.prepare(`
      SELECT * FROM presentaciones_producto WHERE id = ? AND producto_id = ?
    `).get(req.params.id, req.params.productoId)
    if (!presentacion) return res.status(404).json({ error: 'Presentación no encontrada' })

    const totalPres = db.prepare(
      'SELECT COUNT(*) AS total FROM presentaciones_producto WHERE producto_id = ?'
    ).get(req.params.productoId)

    if (totalPres.total <= 1)
      return res.status(400).json({ error: 'No se puede eliminar: el producto debe tener al menos una presentación' })

    const eliminar = db.transaction(() => {
      db.prepare('DELETE FROM presentaciones_producto WHERE id = ?').run(req.params.id)

      if (presentacion.es_venta_defecto) {
        const otra = db.prepare(
          'SELECT id FROM presentaciones_producto WHERE producto_id = ? LIMIT 1'
        ).get(req.params.productoId)
        if (otra) {
          db.prepare('UPDATE presentaciones_producto SET es_venta_defecto = 1 WHERE id = ?').run(otra.id)
        }
      }

      if (presentacion.es_compra_defecto) {
        const otra = db.prepare(
          'SELECT id FROM presentaciones_producto WHERE producto_id = ? LIMIT 1'
        ).get(req.params.productoId)
        if (otra) {
          db.prepare('UPDATE presentaciones_producto SET es_compra_defecto = 1 WHERE id = ?').run(otra.id)
        }
      }
    })()

    res.json({ mensaje: 'Presentación eliminada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAllByProduct, create, update, remove }
