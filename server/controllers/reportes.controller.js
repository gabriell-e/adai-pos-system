const { db } = require('../db')
const { normalizarTexto } = require('../utils/texto')
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
    if (busqueda && busqueda.trim()) {
      // norm() quita acentos dentro de SQL. Sin esto el LIKE de SQLite solo
      // distingue mayúsculas, y "jabon" no encuentra "Jabón".
      const q = normalizarTexto(busqueda)
      sql += ' AND (norm(p.nombre) LIKE ? OR norm(p.codigo_barras) LIKE ?)'
      params.push(`%${q}%`, `%${q}%`)
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
    if (busqueda && busqueda.trim()) {
      // norm() quita acentos dentro de SQL. Sin esto el LIKE de SQLite solo
      // distingue mayúsculas, y "jabon" no encuentra "Jabón".
      const q = normalizarTexto(busqueda)
      sql += ' AND (norm(p.nombre) LIKE ? OR norm(p.codigo_barras) LIKE ?)'
      params.push(`%${q}%`, `%${q}%`)
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

// ─── GRÁFICAS (dashboard) ──────────────────────────────────────────────────
const PERIODOS = {
  hoy:       { dias: 0,  etiqueta: 'Hoy' },
  '7dias':   { dias: 6,  etiqueta: 'Últimos 7 días' },
  '30dias':  { dias: 29, etiqueta: 'Últimos 30 días' },
  mes:       { dias: null, etiqueta: 'Mes actual' }
}

const graficas = (req, res) => {
  try {
    const { periodo = '7dias' } = req.query
    const conf = PERIODOS[periodo] || PERIODOS['7dias']

    let desde
    if (periodo === 'mes') {
      desde = new Date().toLocaleDateString('sv-SE').slice(0, 8) + '01'
    } else {
      desde = new Date(Date.now() - conf.dias * 86400000).toLocaleDateString('sv-SE')
    }

    // ── Ventas por día
    const porDia = db.prepare(`
      SELECT date(creado_en) AS dia, COUNT(*) AS ventas, SUM(total) AS monto
      FROM ventas
      WHERE estado = 'completada' AND date(creado_en) >= ?
      GROUP BY dia ORDER BY dia
    `).all(desde)

    // ── Medios de pago
    const porPago = db.prepare(`
      SELECT tipo_pago AS tipo, COUNT(*) AS ventas, SUM(total) AS monto
      FROM ventas
      WHERE estado = 'completada' AND date(creado_en) >= ?
      GROUP BY tipo_pago ORDER BY monto DESC
    `).all(desde)

    // ── Top productos
    const topProductos = db.prepare(`
      SELECT p.nombre, SUM(dv.cantidad) AS unidades, SUM(dv.subtotal) AS monto
      FROM detalle_venta dv
      JOIN ventas v ON dv.venta_id = v.id
      JOIN productos p ON dv.producto_id = p.id
      WHERE v.estado = 'completada' AND date(v.creado_en) >= ?
      GROUP BY p.id ORDER BY monto DESC
      LIMIT 8
    `).all(desde)

    // ── Ventas por hora
    const porHora = db.prepare(`
      SELECT strftime('%H', creado_en) AS hora, COUNT(*) AS ventas, SUM(total) AS monto
      FROM ventas
      WHERE estado = 'completada' AND date(creado_en) >= ?
      GROUP BY hora ORDER BY hora
    `).all(desde)

    // ── Gastos por día (para contrastar con las ventas)
    const gastosPorDia = db.prepare(`
      SELECT date(creado_en) AS dia, SUM(monto) AS monto
      FROM gastos
      WHERE estado = 'registrado' AND date(creado_en) >= ?
      GROUP BY dia
    `).all(desde)

    // ── Consumo propio por día
    //
    // Se valora a precio de compra, no a precio de venta: el consumo no genera
    // ninguna venta, así que la pérdida real es lo que costó comprar esos
    // productos. Anular un consumo lo borra de la tabla, así que acá no hay
    // que filtrar por estado.
    const consumoPorDia = db.prepare(`
      SELECT
        date(c.creado_en) AS dia,
        SUM(c.cantidad) AS unidades,
        SUM(c.cantidad * COALESCE(p.precio_compra, 0)) AS monto
      FROM consumo_propio c
      JOIN productos p ON c.producto_id = p.id
      WHERE date(c.creado_en) >= ?
      GROUP BY dia
    `).all(desde)

    const totalVentas  = porDia.reduce((a, d) => a + d.monto, 0)
    const totalGastos  = gastosPorDia.reduce((a, d) => a + d.monto, 0)
    const totalConsumo = consumoPorDia.reduce((a, d) => a + d.monto, 0)
    const unidadesConsumo = consumoPorDia.reduce((a, d) => a + d.unidades, 0)
    const cantidadVentas = porDia.reduce((a, d) => a + d.ventas, 0)

    res.json({
      periodo:  conf.etiqueta,
      desde,
      resumen: {
        monto_ventas: totalVentas,
        cantidad_ventas: cantidadVentas,
        ticket_promedio: cantidadVentas ? Math.round(totalVentas / cantidadVentas) : 0,
        total_gastos: totalGastos,
        // El consumo propio también sale de la caja, aunque no figure en
        // gastos: son productos que se llevaron y no se vendieron. Por eso
        // "tras gastos" descuenta las dos cosas.
        total_consumo: totalConsumo,
        unidades_consumo: unidadesConsumo,
        resultado_tras_gastos: totalVentas - totalGastos - totalConsumo
      },
      por_dia: porDia.map(d => ({ dia: d.dia, monto: d.monto, ventas: d.ventas })),
      por_pago: porPago.map(p => ({ tipo: p.tipo, monto: p.monto, ventas: p.ventas })),
      top_productos: topProductos,
      por_hora: porHora.map(h => ({ hora: h.hora, monto: h.monto, ventas: h.ventas })),
      gastos_por_dia: gastosPorDia,
      consumo_por_dia: consumoPorDia
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { inventario, inventarioExcel, ventas, ventasExcel, graficas }
