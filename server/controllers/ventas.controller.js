const { db } = require('../db')

// Extrae IVA incluido en el precio (Paraguay)
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

const generarNumeroFactura = (config) => {
  if (!config) return null
  const nro = String(config.factura_desde).padStart(7, '0')
  return `${config.establecimiento}-${config.punto_expedicion}-${nro}`
}

// ─── GET ALL ────────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  try {
    const ventas = db.prepare(`
      SELECT
        v.*,
        c.nombre  AS cliente_nombre,
        c.ruc_ci  AS cliente_ruc_ci,
        u.nombre  AS cajero_nombre
      FROM ventas v
      LEFT JOIN clientes  c ON v.cliente_id  = c.id
      LEFT JOIN usuarios  u ON v.usuario_id  = u.id
      ORDER BY v.creado_en DESC
    `).all()
    res.json(ventas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── GET BY ID ───────────────────────────────────────────────────────────────
const getById = (req, res) => {
  try {
    const venta = db.prepare(`
      SELECT
        v.*,
        c.nombre  AS cliente_nombre,
        c.ruc_ci  AS cliente_ruc_ci,
        u.nombre  AS cajero_nombre,
        cfg.razon_social, cfg.ruc AS empresa_ruc,
        cfg.direccion, cfg.timbrado, cfg.timbrado_inicio
      FROM ventas v
      LEFT JOIN clientes      c   ON v.cliente_id  = c.id
      LEFT JOIN usuarios      u   ON v.usuario_id  = u.id
      LEFT JOIN configuracion cfg ON v.timbrado_id = cfg.id
      WHERE v.id = ?
    `).get(req.params.id)

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' })

    const detalle = db.prepare(`
      SELECT
        dv.*,
        p.nombre AS producto_nombre,
        p.codigo_barras
      FROM detalle_venta dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = ?
    `).all(req.params.id)

    res.json({ ...venta, detalle })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CREAR VENTA ─────────────────────────────────────────────────────────────
const crear = (req, res) => {
  const {
    cliente_id, usuario_id, condicion_venta,
    tipo_pago, descuento, monto_pagado, orden_nro, items
  } = req.body

  if (!items || items.length === 0)
    return res.status(400).json({ error: 'La venta debe tener al menos un producto' })
  if (!tipo_pago)
    return res.status(400).json({ error: 'El tipo de pago es obligatorio' })
  if (!usuario_id)
    return res.status(400).json({ error: 'El usuario es obligatorio' })
  if (tipo_pago === 'fiado' && !cliente_id)
    return res.status(400).json({ error: 'Venta fiada requiere un cliente' })

  try {
    const realizarVenta = db.transaction(() => {

      // 1. Config y número de factura
      const config = db.prepare('SELECT * FROM configuracion ORDER BY id DESC LIMIT 1').get()
      const numero_factura = generarNumeroFactura(config)
      if (config) {
        db.prepare('UPDATE configuracion SET factura_desde = factura_desde + 1 WHERE id = ?')
          .run(config.id)
      }

      // 2. Validar productos y calcular totales
      let subtotal_gravado_10 = 0
      let subtotal_gravado_5  = 0
      let subtotal_exento     = 0
      let iva_10 = 0
      let iva_5  = 0
      let totalBruto = 0

      const itemsCalculados = items.map(item => {
        if (!item.producto_id || !item.cantidad || !item.precio_unitario)
          throw new Error('Cada item requiere producto_id, cantidad y precio_unitario')

        const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1')
          .get(item.producto_id)
        if (!producto)
          throw new Error(`Producto ID ${item.producto_id} no encontrado o inactivo`)
        if (producto.stock < item.cantidad)
          throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}`)

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

        totalBruto += subtotal

        return {
          producto_id:     item.producto_id,
          cantidad:        item.cantidad,
          precio_unitario: item.precio_unitario,
          tasa_iva:        producto.tasa_iva,
          monto_iva:       iva,
          subtotal
        }
      })

      // 3. Total final
      const descuentoAplicado = descuento || 0
      const total  = totalBruto - descuentoAplicado
      const vuelto = monto_pagado ? Math.max(0, monto_pagado - total) : 0

      // 4. Insertar cabecera de venta
      const ventaResult = db.prepare(`
        INSERT INTO ventas (
          numero_factura, timbrado_id, cliente_id, usuario_id,
          condicion_venta, tipo_pago,
          subtotal_gravado_10, subtotal_gravado_5, subtotal_exento,
          iva_10, iva_5, descuento, total, monto_pagado, vuelto, orden_nro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numero_factura,
        config?.id  || null,
        cliente_id  || null,
        usuario_id,
        condicion_venta || 'contado',
        tipo_pago,
        subtotal_gravado_10,
        subtotal_gravado_5,
        subtotal_exento,
        iva_10,
        iva_5,
        descuentoAplicado,
        total,
        monto_pagado || 0,
        vuelto,
        orden_nro || null
      )

      const venta_id = ventaResult.lastInsertRowid

      // 5. Insertar detalle + actualizar stock + movimientos
      const stmtDetalle    = db.prepare(`
        INSERT INTO detalle_venta
          (venta_id, producto_id, cantidad, precio_unitario, tasa_iva, monto_iva, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const stmtStock      = db.prepare('UPDATE productos SET stock = stock - ? WHERE id = ?')
      const stmtMovimiento = db.prepare(`
        INSERT INTO movimientos_stock
          (producto_id, usuario_id, tipo, cantidad, referencia_tipo, referencia_id, motivo)
        VALUES (?, ?, 'salida', ?, 'venta', ?, 'Venta registrada')
      `)

      for (const item of itemsCalculados) {
        stmtDetalle.run(
          venta_id, item.producto_id, item.cantidad,
          item.precio_unitario, item.tasa_iva, item.monto_iva, item.subtotal
        )
        stmtStock.run(item.cantidad, item.producto_id)
        stmtMovimiento.run(item.producto_id, usuario_id, item.cantidad, venta_id)
      }

      // 6. Si es fiado, actualizar deuda del cliente
      if (tipo_pago === 'fiado' && cliente_id) {
        db.prepare('UPDATE clientes SET deuda_total = deuda_total + ? WHERE id = ?')
          .run(total, cliente_id)
      }

      return { venta_id, numero_factura, total, vuelto, iva_10, iva_5 }
    })

    const resultado = realizarVenta()
    res.status(201).json({ mensaje: 'Venta registrada exitosamente', ...resultado })

  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// ─── ANULAR VENTA ────────────────────────────────────────────────────────────
const anular = (req, res) => {
  try {
    const anularVenta = db.transaction(() => {
      const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.id)
      if (!venta) throw new Error('Venta no encontrada')
      if (venta.estado === 'anulada') throw new Error('La venta ya está anulada')

      // Revertir stock
      const detalle = db.prepare('SELECT * FROM detalle_venta WHERE venta_id = ?').all(req.params.id)

      const stmtStock      = db.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?')
      const stmtMovimiento = db.prepare(`
        INSERT INTO movimientos_stock
          (producto_id, usuario_id, tipo, cantidad, referencia_tipo, referencia_id, motivo)
        VALUES (?, ?, 'entrada', ?, 'venta', ?, 'Anulación de venta')
      `)

      for (const item of detalle) {
        stmtStock.run(item.cantidad, item.producto_id)
        stmtMovimiento.run(item.producto_id, venta.usuario_id, item.cantidad, venta.id)
      }

      // Si era fiada, revertir deuda
      if (venta.tipo_pago === 'fiado' && venta.cliente_id) {
        db.prepare('UPDATE clientes SET deuda_total = deuda_total - ? WHERE id = ?')
          .run(venta.total, venta.cliente_id)
      }

      db.prepare('UPDATE ventas SET estado = ? WHERE id = ?').run('anulada', req.params.id)
    })

    anularVenta()
    res.json({ mensaje: 'Venta anulada correctamente' })

  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

module.exports = { getAll, getById, crear, anular }