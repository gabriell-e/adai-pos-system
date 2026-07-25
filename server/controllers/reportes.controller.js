const { db } = require('../db')
const XLSX = require('xlsx')

const formatGs = n => Number(n || 0)

// ─── REPORTE DE INVENTARIO ──────────────────────────────────────────────
const inventario = (req, res) => {
  try {
    const { categoria_id, busqueda, solo_stock_bajo } = req.query

    let sql = `
      SELECT
        p.id,
        p.nombre,
        p.codigo_barras,
        p.precio_compra,
        p.precio_venta,
        CASE WHEN p.precio_compra > 0
          THEN ROUND((p.precio_venta - p.precio_compra) * 100.0 / p.precio_compra, 1)
          ELSE 0
        END AS margen_porcentaje,
        p.stock,
        p.stock_minimo,
        p.unidad,
        p.tasa_iva,
        c.nombre AS categoria_nombre,
        p.activo,
        (p.stock * p.precio_compra) AS valor_compra,
        (p.stock * p.precio_venta) AS valor_venta
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE 1=1
    `
    const params = []

    if (categoria_id) {
      sql += ' AND p.categoria_id = ?'
      params.push(Number(categoria_id))
    }
    if (busqueda) {
      sql += ' AND (p.nombre LIKE ? OR p.codigo_barras LIKE ?)'
      params.push(`%${busqueda}%`, `%${busqueda}%`)
    }
    if (solo_stock_bajo === '1') {
      sql += ' AND p.stock <= p.stock_minimo AND p.activo = 1'
    }

    sql += ' ORDER BY p.nombre'

    const productos = db.prepare(sql).all(...params)

    // Agregar presentaciones
    const presStmt = db.prepare('SELECT * FROM presentaciones_producto WHERE producto_id = ?')
    const result = productos.map(p => ({
      ...p,
      presentaciones: presStmt.all(p.id)
    }))

    // Resumen
    const activos = result.filter(p => p.activo)
    const resumen = {
      total_productos: activos.length,
      total_unidades: activos.reduce((a, p) => a + p.stock, 0),
      valor_compra_total: activos.reduce((a, p) => a + p.valor_compra, 0),
      valor_venta_total: activos.reduce((a, p) => a + p.valor_venta, 0),
      stock_bajo: activos.filter(p => p.stock <= p.stock_minimo).length,
      productos_inactivos: result.filter(p => !p.activo).length
    }

    res.json({ productos: result, resumen })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── EXPORTAR INVENTARIO A EXCEL ────────────────────────────────────────
const inventarioExcel = (req, res) => {
  try {
    const { categoria_id, busqueda, solo_stock_bajo } = req.query

    let sql = `
      SELECT
        p.nombre AS "Producto",
        p.codigo_barras AS "Código de Barras",
        COALESCE(c.nombre, 'Sin categoría') AS "Categoría",
        p.precio_compra AS "P. Compra",
        p.precio_venta AS "P. Venta",
        CASE WHEN p.precio_compra > 0
          THEN ROUND((p.precio_venta - p.precio_compra) * 100.0 / p.precio_compra, 1)
          ELSE 0
        END AS "Margen %",
        p.stock AS "Stock Actual",
        p.stock_minimo AS "Stock Mínimo",
        p.unidad AS "Unidad",
        p.tasa_iva AS "IVA %",
        CASE WHEN p.activo = 1 THEN 'Activo' ELSE 'Inactivo' END AS "Estado",
        (p.stock * p.precio_compra) AS "Valor Compra",
        (p.stock * p.precio_venta) AS "Valor Venta"
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE 1=1
    `
    const params = []

    if (categoria_id) {
      sql += ' AND p.categoria_id = ?'
      params.push(Number(categoria_id))
    }
    if (busqueda) {
      sql += ' AND (p.nombre LIKE ? OR p.codigo_barras LIKE ?)'
      params.push(`%${busqueda}%`, `%${busqueda}%`)
    }
    if (solo_stock_bajo === '1') {
      sql += ' AND p.stock <= p.stock_minimo AND p.activo = 1'
    }

    sql += ' ORDER BY p.nombre'

    const productos = db.prepare(sql).all(...params)

    // Hoja de resumen
    const activos = productos.filter(p => p['Estado'] === 'Activo')
    const costoTotal = activos.reduce((a, p) => a + p['Valor Compra'], 0)
    const ventaTotal = activos.reduce((a, p) => a + p['Valor Venta'], 0)
    const resumen = [[
      ['REPORTE DE INVENTARIO - STOCK VALORIZADO'],
      ['Fecha', new Date().toLocaleDateString('es-PY')],
      [''],
      ['Total productos', activos.length],
      ['Stock bajo', activos.filter(p => p['Stock Actual'] <= p['Stock Mínimo']).length],
      ['Costo total (inversión)', costoTotal],
      ['Valor de venta total', ventaTotal],
      ['Ganancia potencial', ventaTotal - costoTotal],
    ]]

    const wb = XLSX.utils.book_new()

    // Hoja de productos
    const ws = XLSX.utils.json_to_sheet(productos)
    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 30 }, { wch: 18 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 8 }, { wch: 10 },
      { wch: 15 }, { wch: 15 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario')

    // Hoja de resumen
    const wsRes = XLSX.utils.aoa_to_sheet(resumen)
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', 'attachment; filename=inventario.xlsx')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── REPORTE DE VENTAS ─────────────────────────────────────────────────
const ventas = (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, cliente_id, tipo_pago, producto_id } = req.query

    let sql = `
      SELECT
        v.id,
        v.numero_factura,
        v.creado_en,
        v.tipo_pago,
        v.condicion_venta,
        v.total,
        v.descuento,
        v.estado,
        v.fiado_pagada,
        c.nombre AS cliente_nombre,
        c.ruc_ci AS cliente_ruc_ci,
        u.nombre AS cajero_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.estado = 'completada'
    `
    const params = []

    if (fecha_desde) {
      sql += ' AND date(v.creado_en) >= ?'
      params.push(fecha_desde)
    }
    if (fecha_hasta) {
      sql += ' AND date(v.creado_en) <= ?'
      params.push(fecha_hasta)
    }
    if (cliente_id) {
      sql += ' AND v.cliente_id = ?'
      params.push(Number(cliente_id))
    }
    if (tipo_pago) {
      sql += ' AND v.tipo_pago = ?'
      params.push(tipo_pago)
    }

    sql += ' ORDER BY v.creado_en DESC'

    const ventasLista = db.prepare(sql).all(...params)

    // Detalles
    const detSql = `
      SELECT
        dv.venta_id,
        dv.producto_id,
        dv.presentacion_id,
        p.nombre AS producto_nombre,
        pp.nombre AS presentacion_nombre,
        pp.unidades_por_paquete,
        dv.cantidad,
        dv.precio_unitario,
        dv.precio_compra_unitario,
        dv.subtotal,
        dv.tasa_iva
      FROM detalle_venta dv
      JOIN productos p ON dv.producto_id = p.id
      LEFT JOIN presentaciones_producto pp ON dv.presentacion_id = pp.id
    `
    let detalles
    if (producto_id) {
      detalles = db.prepare(detSql + ' WHERE dv.producto_id = ?').all(Number(producto_id))
    } else {
      detalles = db.prepare(detSql).all()
    }

    // Mapa de detalles por venta
    const detMap = {}
    for (const d of detalles) {
      if (!detMap[d.venta_id]) detMap[d.venta_id] = []
      detMap[d.venta_id].push(d)
    }

    const ventasConDetalle = ventasLista.map(v => ({
      ...v,
      detalle: detMap[v.id] || [],
      costo_total: (detMap[v.id] || []).reduce((a, d) => a + (d.precio_compra_unitario || 0) * d.cantidad, 0)
    }))

    // Resumen
    const resumen = {
      total_ventas: ventasConDetalle.length,
      monto_total: ventasConDetalle.reduce((a, v) => a + v.total, 0),
      costo_total: ventasConDetalle.reduce((a, v) => a + v.costo_total, 0),
      ganancia_neta: ventasConDetalle.reduce((a, v) => a + (v.total - v.costo_total), 0),
      por_tipo_pago: {}
    }

    for (const v of ventasConDetalle) {
      if (!resumen.por_tipo_pago[v.tipo_pago]) {
        resumen.por_tipo_pago[v.tipo_pago] = { cantidad: 0, total: 0 }
      }
      resumen.por_tipo_pago[v.tipo_pago].cantidad++
      resumen.por_tipo_pago[v.tipo_pago].total += v.total
    }

    res.json({ ventas: ventasConDetalle, resumen })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── EXPORTAR VENTAS A EXCEL ───────────────────────────────────────────
const ventasExcel = (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, cliente_id, tipo_pago, producto_id } = req.query

    let sql = `
      SELECT
        v.numero_factura AS "N° Factura",
        v.creado_en AS "Fecha",
        COALESCE(c.nombre, 'Consumidor final') AS "Cliente",
        c.ruc_ci AS "RUC/CI",
        u.nombre AS "Cajero",
        v.tipo_pago AS "Tipo Pago",
        v.condicion_venta AS "Condición",
        v.total AS "Total",
        v.descuento AS "Descuento",
        v.estado AS "Estado"
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.estado = 'completada'
    `
    const params = []

    if (fecha_desde) { sql += ' AND date(v.creado_en) >= ?'; params.push(fecha_desde) }
    if (fecha_hasta) { sql += ' AND date(v.creado_en) <= ?'; params.push(fecha_hasta) }
    if (cliente_id) { sql += ' AND v.cliente_id = ?'; params.push(Number(cliente_id)) }
    if (tipo_pago) { sql += ' AND v.tipo_pago = ?'; params.push(tipo_pago) }

    sql += ' ORDER BY v.creado_en DESC'

    const ventasLista = db.prepare(sql).all(...params)

    // Detalles de productos vendidos
    let detSql = `
      SELECT
        v.numero_factura AS "N° Factura",
        v.creado_en AS "Fecha Venta",
        COALESCE(c.nombre, 'Consumidor final') AS "Cliente",
        p.nombre AS "Producto",
        COALESCE(pp.nombre, 'Unidad') AS "Presentación",
        dv.cantidad AS "Cantidad",
        dv.precio_unitario AS "P. Unitario",
        dv.subtotal AS "Subtotal",
        dv.precio_compra_unitario AS "Costo Unit.",
        CASE WHEN dv.precio_compra_unitario > 0
          THEN ROUND((dv.precio_unitario - dv.precio_compra_unitario) * dv.cantidad, 0)
          ELSE 0
        END AS "Ganancia"
      FROM detalle_venta dv
      JOIN ventas v ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      LEFT JOIN presentaciones_producto pp ON dv.presentacion_id = pp.id
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.estado = 'completada'
    `
    const detParams = []
    if (fecha_desde) { detSql += ' AND date(v.creado_en) >= ?'; detParams.push(fecha_desde) }
    if (fecha_hasta) { detSql += ' AND date(v.creado_en) <= ?'; detParams.push(fecha_hasta) }
    if (cliente_id) { detSql += ' AND v.cliente_id = ?'; detParams.push(Number(cliente_id)) }
    if (tipo_pago) { detSql += ' AND v.tipo_pago = ?'; detParams.push(tipo_pago) }
    if (producto_id) { detSql += ' AND dv.producto_id = ?'; detParams.push(Number(producto_id)) }
    detSql += ' ORDER BY v.creado_en DESC'

    const detalles = db.prepare(detSql).all(...detParams)

    const wb = XLSX.utils.book_new()

    // Hoja resumen de ventas
    const wsVentas = XLSX.utils.json_to_sheet(ventasLista)
    wsVentas['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 15 },
      { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }
    ]
    XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas')

    // Hoja detalle de productos
    const wsDet = XLSX.utils.json_to_sheet(detalles)
    wsDet['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 25 },
      { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }
    ]
    XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle Productos')

    // Hoja resumen
    const totalVentas = ventasLista.reduce((a, v) => a + v['Total'], 0)
    const totalGanancia = detalles.reduce((a, d) => a + d['Ganancia'], 0)
    const resumenData = [
      ['REPORTE DE VENTAS'],
      ['Fecha desde', fecha_desde || 'Todas'],
      ['Fecha hasta', fecha_hasta || 'Todas'],
      [''],
      ['Total ventas', ventasLista.length],
      ['Monto total', totalVentas],
      ['Ganancia neta', totalGanancia],
    ]
    const wsRes = XLSX.utils.aoa_to_sheet(resumenData)
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', 'attachment; filename=ventas.xlsx')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { inventario, inventarioExcel, ventas, ventasExcel }
