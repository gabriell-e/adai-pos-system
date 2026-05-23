const { db } = require('../db')
const { ahora } = require('../utils/fecha')

const getAll = (req, res) => {
  try {
    const consumos = db.prepare(`
      SELECT
        c.*,
        p.nombre   AS producto_nombre,
        p.unidad   AS producto_unidad,
        u.nombre   AS usuario_nombre
      FROM consumo_propio c
      JOIN productos p ON c.producto_id = p.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.creado_en DESC
    `).all()
    res.json(consumos)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const crear = (req, res) => {
  const { producto_id, usuario_id, cantidad, motivo } = req.body

  if (!producto_id) return res.status(400).json({ error: 'El producto es obligatorio' })
  if (!cantidad || cantidad <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' })

  try {
    const registrar = db.transaction(() => {
      const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(producto_id)
      if (!producto) throw new Error('Producto no encontrado o inactivo')
      if (producto.stock < cantidad) throw new Error(`Stock insuficiente. Disponible: ${producto.stock}`)

      const result = db.prepare(`
        INSERT INTO consumo_propio (producto_id, usuario_id, cantidad, motivo, creado_en)
        VALUES (?, ?, ?, ?, ?)
      `).run(producto_id, usuario_id || null, cantidad, motivo || null, ahora())

      db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')
        .run(cantidad, producto_id)

      db.prepare(`
        INSERT INTO movimientos_stock
          (producto_id, usuario_id, tipo, cantidad, referencia_tipo, referencia_id, motivo)
        VALUES (?, ?, 'salida', ?, 'manual', ?, 'Consumo propio')
      `).run(producto_id, usuario_id || null, cantidad, result.lastInsertRowid)

      return result.lastInsertRowid
    })

    const id = registrar()
    res.status(201).json({ id, mensaje: 'Consumo registrado' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

const anular = (req, res) => {
  try {
    const anularConsumo = db.transaction(() => {
      const consumo = db.prepare('SELECT * FROM consumo_propio WHERE id = ?').get(req.params.id)
      if (!consumo) throw new Error('Consumo no encontrado')

      db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?')
        .run(consumo.cantidad, consumo.producto_id)

      db.prepare(`
        INSERT INTO movimientos_stock
          (producto_id, usuario_id, tipo, cantidad, referencia_tipo, referencia_id, motivo)
        VALUES (?, ?, 'entrada', ?, 'manual', ?, 'Anulación consumo propio')
      `).run(consumo.producto_id, consumo.usuario_id, consumo.cantidad, consumo.id)

      db.prepare('DELETE FROM consumo_propio WHERE id = ?').run(req.params.id)
    })

    anularConsumo()
    res.json({ mensaje: 'Consumo anulado y stock revertido' })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

module.exports = { getAll, crear, anular }