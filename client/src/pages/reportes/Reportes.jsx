import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

const formatGs = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`
const toLocalDate = (d) => {
  const dd = new Date(d)
  dd.setMinutes(dd.getMinutes() - dd.getTimezoneOffset())
  return dd.toISOString().slice(0, 10)
}

const Reportes = () => {
  const [tab, setTab] = useState('ventas')
  const [cargando, setCargando] = useState(false)
  const [errorMsj, setErrorMsj] = useState('')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {[['ventas', 'Ventas'], ['inventario', 'Inventario']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {errorMsj && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
          {errorMsj}
        </div>
      )}

      {tab === 'ventas' && <VentasTab cargando={cargando} setCargando={setCargando} setErrorMsj={setErrorMsj} />}
      {tab === 'inventario' && <InventarioTab cargando={cargando} setCargando={setCargando} setErrorMsj={setErrorMsj} />}
    </div>
  )
}

function VentasTab({ cargando, setCargando, setErrorMsj }) {
  const [fechaDesde, setFechaDesde] = useState(toLocalDate(new Date()))
  const [fechaHasta, setFechaHasta] = useState(toLocalDate(new Date()))
  const [tipoPagoFiltro, setTipoPagoFiltro] = useState('')
  const [data, setData] = useState(null)
  const [filtroRapido, setFiltroRapido] = useState('hoy')

  const presets = [
    { key: 'hoy',          label: 'Hoy' },
    { key: 'ayer',         label: 'Ayer' },
    { key: 'semana',       label: 'Esta semana' },
    { key: 'mes',          label: 'Este mes' },
    { key: 'personalizado', label: 'Personalizado' },
  ]

  const aplicarPreset = (key) => {
    setFiltroRapido(key)
    const hoy = new Date()
    const fmt = d => toLocalDate(d)
    let desde, hasta

    switch (key) {
      case 'hoy':
        desde = hasta = fmt(hoy)
        break
      case 'ayer': {
        const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
        desde = hasta = fmt(ayer)
        break
      }
      case 'semana': {
        const d = new Date(hoy)
        const dia = d.getDay()
        const diffLunes = dia === 0 ? 6 : dia - 1
        d.setDate(d.getDate() - diffLunes)
        desde = fmt(d)
        hasta = fmt(hoy)
        break
      }
      case 'mes': {
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        desde = fmt(primero)
        hasta = fmt(hoy)
        break
      }
      default:
        return
    }
    setFechaDesde(desde)
    setFechaHasta(hasta)
  }

  const cargar = useCallback(async (desde, hasta, tipo) => {
    setCargando(true)
    setErrorMsj('')
    try {
      const p = new URLSearchParams()
      if (desde) p.set('fecha_desde', desde)
      if (hasta) p.set('fecha_hasta', hasta)
      if (tipo) p.set('tipo_pago', tipo)
      const { data: resp } = await api.get('/reportes/ventas?' + p.toString())
      setData(resp)
    } catch (err) {
      setErrorMsj(err.response?.data?.error || 'Error al cargar ventas')
    }
    setCargando(false)
  }, [setCargando, setErrorMsj])

  useEffect(() => {
    aplicarPreset('hoy')
  }, [])

  useEffect(() => {
    if (filtroRapido !== 'personalizado') {
      cargar(fechaDesde, fechaHasta, tipoPagoFiltro)
    }
  }, [fechaDesde, fechaHasta, tipoPagoFiltro])

  const buscar = () => cargar(fechaDesde, fechaHasta, tipoPagoFiltro)

  const exportar = () => {
    const p = new URLSearchParams()
    if (fechaDesde) p.set('fecha_desde', fechaDesde)
    if (fechaHasta) p.set('fecha_hasta', fechaHasta)
    if (tipoPagoFiltro) p.set('tipo_pago', tipoPagoFiltro)
    const token = localStorage.getItem('token')
    window.open('/api/reportes/ventas/excel?' + p.toString() + '&token=' + token, '_blank')
  }

  const res = data?.resumen

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {presets.map(pr => (
            <button key={pr.key} onClick={() => aplicarPreset(pr.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroRapido === pr.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {pr.label}
            </button>
          ))}
        </div>

        {filtroRapido === 'personalizado' && (
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
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap">
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
          <button onClick={buscar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Buscar
          </button>
          <button onClick={exportar}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Excel
          </button>
        </div>
      </div>

      {res && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CardResumen label="Total ventas" value={res.total_ventas} color="text-blue-600" />
          <CardResumen label="Monto total" value={formatGs(res.monto_total)} color="text-emerald-600" />
          <CardResumen label="Costo total" value={formatGs(res.costo_total)} color="text-orange-600" />
          <CardResumen label="Ganancia neta" value={formatGs(res.ganancia_neta)} color="text-emerald-700" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : !data ? (
          <div className="p-8 text-center text-gray-400">Presiona Buscar para cargar los datos</div>
        ) : data.ventas.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay ventas en el periodo seleccionado</div>
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
                {data.ventas.map(v => {
                  const g = v.total - v.costo_total
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-gray-600">{v.numero_factura}</td>
                      <td className="px-4 py-2.5 text-gray-600">{new Date(v.creado_en).toLocaleDateString('es-PY')}</td>
                      <td className="px-4 py-2.5">{v.cliente_nombre || 'Final'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{v.tipo_pago}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatGs(v.total)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{formatGs(v.costo_total)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${g >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatGs(g)}
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
  )
}

function InventarioTab({ cargando, setCargando, setErrorMsj }) {
  const [categoriaId, setCategoriaId] = useState('')
  const [busquedaProd, setBusquedaProd] = useState('')
  const [soloStockBajo, setSoloStockBajo] = useState(false)
  const [data, setData] = useState(null)
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    api.get('/categorias').then(r => setCategorias(r.data)).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorMsj('')
    try {
      const p = new URLSearchParams()
      if (categoriaId) p.set('categoria_id', categoriaId)
      if (busquedaProd) p.set('busqueda', busquedaProd)
      if (soloStockBajo) p.set('solo_stock_bajo', '1')
      const { data: resp } = await api.get('/reportes/inventario?' + p.toString())
      setData(resp)
    } catch (err) {
      setErrorMsj(err.response?.data?.error || 'Error al cargar inventario')
    }
    setCargando(false)
  }, [categoriaId, busquedaProd, soloStockBajo, setCargando, setErrorMsj])

  useEffect(() => {
    cargar()
  }, [])

  const exportar = () => {
    const p = new URLSearchParams()
    if (categoriaId) p.set('categoria_id', categoriaId)
    if (busquedaProd) p.set('busqueda', busquedaProd)
    if (soloStockBajo) p.set('solo_stock_bajo', '1')
    const token = localStorage.getItem('token')
    window.open('/api/reportes/inventario/excel?' + p.toString() + '&token=' + token, '_blank')
  }

  const res = data?.resumen

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
              <option value="">Todas</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar producto</label>
            <input type="text" value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)}
              placeholder="Nombre o codigo..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
            <input type="checkbox" checked={soloStockBajo} onChange={e => setSoloStockBajo(e.target.checked)}
              className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
            Solo stock bajo
          </label>
          <button onClick={cargar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Buscar
          </button>
          <button onClick={exportar}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Excel
          </button>
        </div>
      </div>

      {res && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <CardResumen label="Productos" value={res.total_productos} color="text-blue-600" />
          <CardResumen label="Unidades" value={res.total_unidades} color="text-gray-700" />
          <CardResumen label="Costo total" value={formatGs(res.valor_compra_total)} color="text-orange-600" />
          <CardResumen label="Valor de venta" value={formatGs(res.valor_venta_total)} color="text-blue-600" />
          <CardResumen label="Ganancia potencial" value={formatGs(res.valor_venta_total - res.valor_compra_total)} color="text-emerald-700" />
          <CardResumen label="Stock bajo" value={res.stock_bajo} color="text-red-500" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : !data ? (
          <div className="p-8 text-center text-gray-400">Cargando inventario...</div>
        ) : data.productos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay productos</div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Categoria</th>
                  <th className="px-4 py-3 text-right">P. Compra</th>
                  <th className="px-4 py-3 text-right">P. Venta</th>
                  <th className="px-4 py-3 text-right">Margen %</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Minimo</th>
                  <th className="px-4 py-3 text-right">Valor compra</th>
                  <th className="px-4 py-3 text-right">Valor venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.productos.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${p.stock <= p.stock_minimo ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{p.nombre}</p>
                      <p className="text-xs text-gray-400">{p.codigo_barras || 'Sin codigo'}</p>
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
  )
}

function CardResumen({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default Reportes
