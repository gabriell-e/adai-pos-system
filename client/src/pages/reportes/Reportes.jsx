import { useState, useEffect } from 'react'
import api from '../../api/axios'

const formatGs = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`
const today = () => new Date().toISOString().slice(0, 10)
const monthsAgo = (m) => {
  const d = new Date()
  d.setMonth(d.getMonth() - m)
  return d.toISOString().slice(0, 10)
}

const Reportes = () => {
  const [pestaña, setPestaña]     = useState('ventas')
  const [cargando, setCargando]   = useState(false)

  // ── Filtros ventas ──────────────────────────────
  const [fechaDesde, setFechaDesde]     = useState(monthsAgo(1))
  const [fechaHasta, setFechaHasta]     = useState(today())
  const [tipoPagoFiltro, setTipoPagoFiltro] = useState('')
  const [ventasData, setVentasData]     = useState(null)

  // ── Filtros inventario ─────────────────────────
  const [categoriaId, setCategoriaId]           = useState('')
  const [busquedaProd, setBusquedaProd]         = useState('')
  const [soloStockBajo, setSoloStockBajo]       = useState(false)
  const [inventarioData, setInventarioData]     = useState(null)
  const [categorias, setCategorias]             = useState([])

  useEffect(() => {
    api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {})
  }, [])

  // ── Cargar ventas ──────────────────────────────
  const cargarVentas = async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.set('fecha_desde', fechaDesde)
      if (fechaHasta) params.set('fecha_hasta', fechaHasta)
      if (tipoPagoFiltro) params.set('tipo_pago', tipoPagoFiltro)
      const { data } = await api.get(`/reportes/ventas?${params}`)
      setVentasData(data)
    } catch (err) {
      console.error(err)
    }
    setCargando(false)
  }

  // ── Cargar inventario ─────────────────────────
  const cargarInventario = async () => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (categoriaId) params.set('categoria_id', categoriaId)
      if (busquedaProd) params.set('busqueda', busquedaProd)
      if (soloStockBajo) params.set('solo_stock_bajo', '1')
      const { data } = await api.get(`/reportes/inventario?${params}`)
      setInventarioData(data)
    } catch (err) {
      console.error(err)
    }
    setCargando(false)
  }

  useEffect(() => {
    if (pestaña === 'ventas') cargarVentas()
    if (pestaña === 'inventario') cargarInventario()
  }, [pestaña])

  // ── Exportar ───────────────────────────────────
  const exportarVentas = () => {
    const params = new URLSearchParams()
    if (fechaDesde) params.set('fecha_desde', fechaDesde)
    if (fechaHasta) params.set('fecha_hasta', fechaHasta)
    if (tipoPagoFiltro) params.set('tipo_pago', tipoPagoFiltro)
    window.open(`/api/reportes/ventas/excel?${params}`, '_blank')
  }

  const exportarInventario = () => {
    const params = new URLSearchParams()
    if (categoriaId) params.set('categoria_id', categoriaId)
    if (busquedaProd) params.set('busqueda', busquedaProd)
    if (soloStockBajo) params.set('solo_stock_bajo', '1')
    window.open(`/api/reportes/inventario/excel?${params}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'ventas',     label: '📊 Ventas' },
          { key: 'inventario', label: '📦 Inventario' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setPestaña(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              pestaña === t.key
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ PESTAÑA VENTAS ═══════════ */}
      {pestaña === 'ventas' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo pago</label>
                <select value={tipoPagoFiltro} onChange={e => setTipoPagoFiltro(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="">Todos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="qr">QR</option>
                  <option value="debito">Débito</option>
                  <option value="mixto">Mixto</option>
                  <option value="fiado">Fiado</option>
                </select>
              </div>
              <button onClick={cargarVentas}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Buscar
              </button>
              <button onClick={exportarVentas}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                📥 Excel
              </button>
            </div>
          </div>

          {/* Resumen */}
          {ventasData?.resumen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total ventas',   value: ventasData.resumen.total_ventas, color: 'text-blue-600' },
                { label: 'Monto total',    value: formatGs(ventasData.resumen.monto_total), color: 'text-emerald-600' },
                { label: 'Costo total',    value: formatGs(ventasData.resumen.costo_total), color: 'text-orange-600' },
                { label: 'Ganancia neta',  value: formatGs(ventasData.resumen.ganancia_neta), color: 'text-emerald-700' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {cargando ? (
              <div className="p-8 text-center text-gray-400">Cargando...</div>
            ) : ventasData?.ventas?.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No hay ventas en el período seleccionado</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Factura</th>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-center">Tipo pago</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Costo</th>
                      <th className="px-4 py-3 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ventasData.ventas.map(v => {
                      const ganancia = v.total - v.costo_total
                      return (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-gray-600">{v.numero_factura}</td>
                          <td className="px-4 py-2.5 text-gray-600">{new Date(v.creado_en).toLocaleDateString('es-PY')}</td>
                          <td className="px-4 py-2.5">{v.cliente_nombre || 'Final'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                              {v.tipo_pago}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">{formatGs(v.total)}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{formatGs(v.costo_total)}</td>
                          <td className={`px-4 py-2.5 text-right font-medium ${ganancia >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatGs(ganancia)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ PESTAÑA INVENTARIO ═══════════ */}
      {pestaña === 'inventario' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Buscar producto</label>
                <input type="text" value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
                  placeholder="Nombre o código..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                <input type="checkbox" checked={soloStockBajo} onChange={e => setSoloStockBajo(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                Solo stock bajo
              </label>
              <button onClick={cargarInventario}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Buscar
              </button>
              <button onClick={exportarInventario}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                📥 Excel
              </button>
            </div>
          </div>

          {/* Resumen - Stock Valorizado */}
          {inventarioData?.resumen && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'Productos',         value: inventarioData.resumen.total_productos, color: 'text-blue-600' },
                { label: 'Unidades',          value: inventarioData.resumen.total_unidades, color: 'text-gray-700' },
                { label: 'Costo total',       value: formatGs(inventarioData.resumen.valor_compra_total), color: 'text-orange-600' },
                { label: 'Valor de venta',    value: formatGs(inventarioData.resumen.valor_venta_total), color: 'text-blue-600' },
                { label: 'Ganancia potencial', value: formatGs(inventarioData.resumen.valor_venta_total - inventarioData.resumen.valor_compra_total), color: 'text-emerald-700' },
                { label: 'Stock bajo',        value: inventarioData.resumen.stock_bajo, color: 'text-red-500' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {cargando ? (
              <div className="p-8 text-center text-gray-400">Cargando...</div>
            ) : inventarioData?.productos?.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No hay productos</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-left">Categoría</th>
                      <th className="px-4 py-3 text-right">P. Compra</th>
                      <th className="px-4 py-3 text-right">P. Venta</th>
                      <th className="px-4 py-3 text-right">Margen %</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Mínimo</th>
                      <th className="px-4 py-3 text-right">Valor compra</th>
                      <th className="px-4 py-3 text-right">Valor venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inventarioData.productos.map(p => (
                      <tr key={p.id} className={`hover:bg-gray-50 ${p.stock <= p.stock_minimo ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{p.nombre}</p>
                          <p className="text-xs text-gray-400">{p.codigo_barras || 'Sin código'}</p>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{p.categoria_nombre || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatGs(p.precio_compra)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatGs(p.precio_venta)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-medium ${p.margen_porcentaje > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {p.margen_porcentaje}%
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-medium ${p.stock <= p.stock_minimo ? 'text-red-500' : 'text-gray-700'}`}>
                          {p.stock}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{p.stock_minimo}</td>
                        <td className="px-4 py-2.5 text-right text-orange-600">{formatGs(p.valor_compra)}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600">{formatGs(p.valor_venta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Reportes
