const { db } = require('../db')
const { ahora } = require('../utils/fecha')

const calcularIVA = (subtotal, tasa) => {
  if (tasa === 10) {
    const iva = Math.round(subtotal / 11)
    return { gravado: subtotal - iva, iva, exento: 0 }
  }
  if (tasa === 5) {
    const iva = Math.round(subtotal / 21)
    return { gravado: subtotal - iva, iva, exento: 0 }
  }
  return { gravado: 0, iva: 0, exento: subtotal }
}

// ─── GET ALL ─────────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  try {
    const compras = db.prepare(`
      SELECT
        c.*,
        p.nombre  AS proveedor_nombre,
        u.nombre  AS usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      LEFT JOIN usuarios    u ON c.usuario_id   = u.id
      ORDER BY c.creado_en DESC
    `).all()
    res.json(compras)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── GET BY ID ───────────────────────────────────────────────────────────────
const getById = (req, res) => {
  try {
    const compra = db.prepare(`
      SELECT
        c.*,
        p.nombre   AS proveedor_nombre,
        p.ruc      AS proveedor_ruc,
        u.nombre   AS usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      LEFT JOIN usuarios    u ON c.usuario_id   = u.id
      WHERE c.id = ?
    `).get(req.params.id)

    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' })

    const detalle = db.prepare(`
      SELECT
        dc.*,
        p.nombre        AS producto_nombre,
        p.codigo_barras
      FROM detalle_compra dc
      JOIN productos p ON dc.producto_id = p.id
      WHERE dc.compra_id = ?
    `).all(req.params.id)

    res.json({ ...compra, detalle })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CREAR COMPRA ─────────────────────────────────────────────────────────────
const crear = (req, res) => {
  const {
    proveedor_id, usuario_id,
    numero_factura_proveedor, items
  } = req.body

  if (!items || items.length === 0)
    return res.status(400).json({ error: 'La compra debe tener al menos un producto' })
  if (!usuario_id)
    return res.status(400).json({ error: 'El usuario es obligatorio' })

  try {
    const realizarCompra = db.transaction(() => {

      // 1. Calcular totales
      let subtotal_gravado_10 = 0
      let subtotal_gravado_5  = 0
      let subtotal_exento     = 0
      let iva_10 = 0
      let iva_5  = 0
      let total  = 0

      const itemsCalculados = items.map(item => {
        if (!item.producto_id || !item.cantidad || !item.precio_unitario)
          throw new Error('Cada item requiere producto_id, cantidad y precio_unitario')

        const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
          .get(item.producto_id)
        if (!producto)
          throw new Error(`Producto ID ${item.producto_id} no encontrado o inactivo`)

        const subtotal = item.precio_unitario * item.cantidad
        const { gravado, iva, exento } = calcularIVA(subtotal, producto.tasa_iva)

        if (producto.tasa_iva === 10) {
          subtotal_gravado_10 += gravado
          iva_10 += iva
        } else if (producto.tasa_iva === 5) {
          subtotal_gravado_5 += gravado
          iva_5 += iva
        } else {
          subtotal_exento += exento
        }

        total += subtotal

        return {
          producto_id:     item.producto_id,
          cantidad:        item.cantidad,
          precio_unitario: item.precio_unitario,
          tasa_iva:        producto.tasa_iva,
          monto_iva:       iva,
          subtotal
        }
      })

      // 2. Insertar cabecera
      const compraResult = db.prepare(`
        INSERT INTO compras (
          numero_factura_proveedor, proveedor_id, usuario_id,
          subtotal_gravado_10, subtotal_gravado_5, subtotal_exento,
          iva_10, iva_5, total, creado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numero_factura_proveedor || null,
        proveedor_id || null,
        usuario_id,
        subtotal_gravado_10,
        subtotal_gravado_5,
        subtotal_exento,
        iva_10,
        iva_5,
        total,
        ahora()
      )

      const compra_id = compraResult.lastInsertRowid

      // 3. Insertar detalle + actualizar stock + movimientos
      const stmtDetalle    = db.prepare(`
        INSERT INTO detalle_compra
          (compra_id, producto_id, cantidad, precio_unitario, tasa_iva, monto_iva, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const stmtStock      = db.prepare(`
        UPDATE productos SET stock = stock + ?, precio_compra = ? WHERE id = ?
      `)
      const stmtMovimiento = db.prepare(`
        INSERT INTO movimientos_stock
          (producto_id, usuario_id, tipo, cantidad, referencia_tipo, referencia_id, motivo, creado_en)
        VALUES (?, ?, 'entrada', ?, 'compra', ?, 'Compra registrada', ?)
      `)

      for (const item of itemsCalculados) {
        stmtDetalle.run(
          compra_id, item.producto_id, item.cantidad,
          item.precio_unitario, item.tasa_iva, item.monto_iva, item.subtotal
        )
        // Actualiza stock Y precio de compra con el último precio pagado
        stmtStock.run(item.cantidad, item.precio_unitario, item.producto_id)
        stmtMovimiento.run(item.producto_id, usuario_id, item.cantidad, compra_id, ahora())
      }

      return { compra_id, total, iva_10, iva_5 }
    })

    const resultado = realizarCompra()
    res.status(201).json({ mensaje: 'Compra registrada exitosamente', ...resultado })

  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// ─── ANULAR COMPRA ───────────────────────────────────────────────────────────
const anular = (req, res) => {
  try {
    const anularCompra = db.transaction(() => {
      const compra = db.prepare('SELECT * FROM compras WHERE id = ?').get(req.params.id)
      if (!compra) throw new Error('Compra no encontrada')
      if (compra.estado === 'anulada') throw new Error('La compra ya está anulada')

      const detalle = db.prepare('SELECT * FROM detalle_compra WHERE compra_id = ?').all(req.params.id)

      // Verificar que haya stock suficiente para revertir
      for (const item of detalle) {
        const producto = db.prepare('SELECT stock, nombre FROM productos WHERE id = ?').get(item.producto_id)
        if (producto.stock < item.cantidad)
          throw new Error(`Stock insuficiente para revertir "${producto.nombre}". Stock actual: ${producto.stock}`)
      }

      const stmtStock      = db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')
      const stmtMovimiento = db.prepare(`
        INSERT INTO movimientos_stock
          (producto_id, usuario_id, tipo, cantidad, referencia_tipo, referencia_id, motivo, creado_en)
        VALUES (?, ?, 'salida', ?, 'compra', ?, 'Anulación de compra', ?)
      `)

      for (const item of detalle) {
        stmtStock.run(item.cantidad, item.producto_id)
        stmtMovimiento.run(item.producto_id, compra.usuario_id, item.cantidad, compra.id, ahora())
      }

      db.prepare('UPDATE compras SET estado = ? WHERE id = ?').run('anulada', req.params.id)
    })

    anularCompra()
    res.json({ mensaje: 'Compra anulada correctamente' })

  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

module.exports = { getAll, getById, crear, anular }