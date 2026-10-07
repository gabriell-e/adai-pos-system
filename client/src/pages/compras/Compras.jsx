import { useState, useEffect, useMemo } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { buscarProductos } from '../../utils/buscar'
import { numeroDecimal } from '../../utils/validar'

const formatGs    = n => `Gs. ${Number(n).toLocaleString('es-PY')}`
const formatFecha = f => new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })

// Selector de producto con buscador. Antes era un <select> con todos los
// productos del local, que con varios cientos habia que recorrer a ciegas. Usa
// el mismo orden por prioridad que la pantalla de venta: al escribir "leche"
// sale primero "Leche", no "Crema de leche".
const SelectorProducto = ({ productos, value, onChange }) => {
  const [texto, setTexto]     = useState('')
  const [abierto, setAbierto] = useState(false)

  const elegido = productos.find(p => p.id === Number(value))

  const coincidencias = texto.trim() ? buscarProductos(productos, texto) : []
  const aMostrar = coincidencias.slice(0, 8)

  const elegir = (p) => {
    onChange(p.id)
    setTexto('')
    setAbierto(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={texto}
        placeholder={elegido ? elegido.nombre : 'Buscar producto...'}
        onChange={e => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className={`w-full border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${elegido ? 'border-emerald-300 bg-emerald-50/40 text-gray-800' : 'border-gray-300'}`}
      />
      {elegido && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { onChange(''); setTexto('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 text-xs"
          title="Quitar producto"
        >✕</button>
      )}

      {abierto && texto.trim() && aMostrar.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-30 mt-1 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {aMostrar.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => elegir(p)}
                className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b last:border-0"
              >
                <p className="text-sm text-gray-800">{p.nombre}</p>
                <p className="text-xs text-gray-400">
                  Stock: {p.stock} {p.unidad || 'u'}
                  {p.codigo_barras ? ` · Cód. ${p.codigo_barras}` : ''}
                </p>
              </button>
            ))}
          </div>
          {coincidencias.length > aMostrar.length && (
            <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
              {coincidencias.length} coincidencias, se muestran las primeras {aMostrar.length}
            </p>
          )}
        </div>
      )}

      {abierto && texto.trim() && aMostrar.length === 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-30 mt-1 px-3 py-2 text-sm text-gray-400">
          Ningún producto coincide con "{texto}"
        </div>
      )}
    </div>
  )
}

const Compras = () => {
  const { usuario } = useAuth()

  const [compras, setCompras]         = useState([])
  const [productos, setProductos]     = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando]       = useState(true)
  const [modal, setModal]             = useState(false)
  const [detalleId, setDetalleId]     = useState(null)
  const [detalle, setDetalle]         = useState(null)
  const [error, setError]             = useState('')
  const [guardando, setGuardando]     = useState(false)

  const [form, setForm] = useState({
    proveedor_id:              '',
    numero_factura_proveedor:  '',
    items:                     [{ producto_id: '', presentation_id: '', cantidad: '', precio_unitario: '' }]
  })

  // Filtros del listado. El periodo es solo una forma rapida de llenar
  // desde/hasta: si el usuario toca las fechas a mano, el periodo se apaga
  // para no pisar lo que eligio.
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', proveedor: '', periodo: '' })

  const cargarDatos = async () => {
    const [compRes, prodRes, provRes] = await Promise.all([
      api.get('/compras'),
      api.get('/productos'),
      api.get('/proveedores')
    ])
    setCompras(compRes.data)
    setProductos(prodRes.data.filter(p => p.activo === 1))
    setProveedores(provRes.data.filter(p => p.activo === 1))
    setCargando(false)
  }

  useEffect(() => { cargarDatos() }, [])

  // Fecha en formato YYYY-MM-DD usando la hora local. No se puede usar
  // toISOString() porque converts a UTC: en Paraguay a la noche esa fecha ya
  // es la del dia siguiente y el filtro correria las compras de un dia.
  const isoLocal = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // 2026-10-05 -> 05/10/2026, que es como lo lee un usuario local.
  const etiquetaDia = dia => {
    const [a, m, d] = dia.split('-')
    return `${d}/${m}/${a}`
  }

  const PERIODOS = [
    { clave: 'hoy',    etiqueta: 'Hoy' },
    { clave: '7dias',  etiqueta: '7 días' },
    { clave: '30dias', etiqueta: '30 días' },
    { clave: 'mes',    etiqueta: 'Este mes' },
    { clave: 'anio',   etiqueta: 'Este año' }
  ]

  const aplicarPeriodo = clave => {
    const hoy = new Date()
    let desde = ''
    let hasta = isoLocal(hoy)

    if (clave === 'hoy') {
      desde = hasta
    } else if (clave === '7dias') {
      const d = new Date(hoy); d.setDate(d.getDate() - 6); desde = isoLocal(d)
    } else if (clave === '30dias') {
      const d = new Date(hoy); d.setDate(d.getDate() - 29); desde = isoLocal(d)
    } else if (clave === 'mes') {
      desde = isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    } else if (clave === 'anio') {
      desde = isoLocal(new Date(hoy.getFullYear(), 0, 1))
    }

    setFiltros(f => ({ ...f, periodo: clave, desde, hasta }))
  }

  const cambiarFecha = (campo, valor) =>
    setFiltros(f => ({ ...f, [campo]: valor, periodo: '' }))

  const limpiarFiltros = () =>
    setFiltros({ desde: '', hasta: '', proveedor: '', periodo: '' })

  const hayFiltro = filtros.desde || filtros.hasta || filtros.proveedor

  const comprasFiltradas = useMemo(() => compras.filter(c => {
    if (filtros.proveedor && String(c.proveedor_id) !== String(filtros.proveedor)) return false
    if (!filtros.desde && !filtros.hasta) return true

    const dia = isoLocal(new Date(c.creado_en))
    if (filtros.desde && dia < filtros.desde) return false
    if (filtros.hasta && dia > filtros.hasta) return false
    return true
  }), [compras, filtros])

  const activasFiltradas = comprasFiltradas.filter(c => c.estado === 'recibida')
  const totalFiltrado     = activasFiltradas.reduce((acc, c) => acc + Number(c.total || 0), 0)
  const anuladasFiltradas = comprasFiltradas.length - activasFiltradas.length

  // Agrupa por dia para que se vea cuanto se compro en cada fecha, que es lo
  // que se pedia al filtrar por fechas.
  const porDia = useMemo(() => {
    const mapa = new Map()
    for (const c of comprasFiltradas) {
      const dia = isoLocal(new Date(c.creado_en))
      if (!mapa.has(dia)) mapa.set(dia, { dia, cantidad: 0, total: 0 })
      const g = mapa.get(dia)
      g.cantidad += 1
      if (c.estado === 'recibida') g.total += Number(c.total || 0)
    }
    return [...mapa.values()].sort((a, b) => b.dia.localeCompare(a.dia))
  }, [comprasFiltradas])

  // Subtotal de cada renglon: cantidad x precio. Se ve mientras se carga la
  // compra, para comparar antes de confirmar.
  const subtotalItem = item =>
    (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0)

  const verDetalle = async (id) => {
    setDetalleId(id)
    const { data } = await api.get(`/compras/${id}`)
    setDetalle(data)
  }

  const cerrarDetalle = () => {
    setDetalleId(null)
    setDetalle(null)
  }

  const agregarItem = () =>
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { producto_id: '', presentation_id: '', cantidad: '', precio_unitario: '' }]
    }))

  const quitarItem = (idx) =>
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }))

  const actualizarItem = (idx, campo, valor) =>
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, [campo]: valor } : item
      )
    }))

  // Autocompletar con la presentación de compra por defecto
  const seleccionarProducto = (idx, producto_id) => {
    const producto = productos.find(p => p.id === Number(producto_id))
    const presDefecto = producto?.presentaciones?.find(p => p.es_compra_defecto === 1)
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx
          ? {
              ...item,
              producto_id,
              presentation_id: presDefecto?.id || '',
              precio_unitario: presDefecto?.precio_compra || producto?.precio_compra || ''
            }
          : item
      )
    }))
  }

  const totalCompra = form.items.reduce((acc, item) => acc + subtotalItem(item), 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const itemsValidos = form.items.filter(i => i.producto_id && i.cantidad && i.precio_unitario)
    if (itemsValidos.length === 0)
      return setError('Agregá al menos un producto con cantidad y precio')

    setGuardando(true)
    try {
      await api.post('/compras', {
        proveedor_id:             form.proveedor_id || null,
        usuario_id:               usuario.id,
        numero_factura_proveedor: form.numero_factura_proveedor || null,
        items: itemsValidos.map(i => ({
          producto_id:     Number(i.producto_id),
          presentation_id: i.presentation_id ? Number(i.presentation_id) : null,
          cantidad:        Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario)
        }))
      })
      await cargarDatos()
      setModal(false)
      setForm({
        proveedor_id: '', numero_factura_proveedor: '',
        items: [{ producto_id: '', presentation_id: '', cantidad: '', precio_unitario: '' }]
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar compra')
    } finally {
      setGuardando(false)
    }
  }

  const anular = async (id) => {
    if (!confirm('¿Anular esta compra? Se revertirá el stock.')) return
    try {
      await api.patch(`/compras/${id}/anular`)
      await cargarDatos()
      if (detalleId === id) cerrarDetalle()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al anular')
    }
  }

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando compras...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Compras</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hayFiltro
              ? `${comprasFiltradas.length} de ${compras.length} compras · ${formatGs(totalFiltrado)} en ${porDia.length} ${porDia.length === 1 ? 'día' : 'días'}`
              : `${compras.length} compras registradas`}
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nueva compra
        </button>
      </div>

      {/* Filtros del listado */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {PERIODOS.map(p => (
              <button
                key={p.clave}
                onClick={() => aplicarPeriodo(p.clave)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtros.periodo === p.clave
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde}
              max={filtros.hasta || undefined}
              onChange={e => cambiarFecha('desde', e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={e => cambiarFecha('hasta', e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="min-w-48">
            <label className="block text-xs text-gray-500 mb-1">Proveedor</label>
            <select
              value={filtros.proveedor}
              onChange={e => setFiltros(f => ({ ...f, proveedor: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {hayFiltro && (
            <button
              onClick={limpiarFiltros}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Cuanto se compro en cada fecha, que es lo que se busca al filtrar */}
        {porDia.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Compras por fecha</p>
            <div className="flex flex-wrap gap-2">
              {porDia.map(d => (
                <button
                  key={d.dia}
                  onClick={() => setFiltros(f => ({ ...f, desde: d.dia, hasta: d.dia, periodo: '' }))}
                  title="Ver solo este día"
                  className="text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 transition-colors"
                >
                  <p className="text-xs text-gray-500">{etiquetaDia(d.dia)}</p>
                  <p className="text-sm font-semibold text-gray-800">{d.cantidad} {d.cantidad === 1 ? 'compra' : 'compras'}</p>
                  <p className="text-xs font-medium text-emerald-700">{formatGs(d.total)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Lista */}
        <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Factura proveedor</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comprasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {hayFiltro
                      ? 'Ninguna compra cae en esas fechas'
                      : 'No hay compras registradas'}
                  </td>
                </tr>
              ) : comprasFiltradas.map(c => (
                <tr
                  key={c.id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${c.estado === 'anulada' ? 'opacity-50' : ''} ${detalleId === c.id ? 'bg-blue-50' : ''}`}
                  onClick={() => verDetalle(c.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {c.numero_factura_proveedor || <span className="text-gray-300">Sin número</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.proveedor_nombre || <span className="text-gray-300">Sin proveedor</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatGs(c.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`
                      inline-block px-2 py-0.5 rounded-full text-xs font-medium
                      ${c.estado === 'recibida'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-600'}
                    `}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(c.creado_en)}</td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    {c.estado === 'recibida' && (
                      <button
                        onClick={() => anular(c.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {comprasFiltradas.length > 0 && (
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-right text-sm text-gray-700">
                    Total ({activasFiltradas.length} compras activas
                    {anuladasFiltradas > 0 ? `, ${anuladasFiltradas} anuladas` : ''})
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-700">
                    {formatGs(totalFiltrado)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Panel detalle */}
        {detalle && (
          <div className="w-80 bg-white rounded-xl shadow-sm p-5 self-start">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-semibold text-gray-800">
                  {detalle.numero_factura_proveedor || `Compra #${detalle.id}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatFecha(detalle.creado_en)}</p>
              </div>
              <button onClick={cerrarDetalle} className="text-gray-300 hover:text-gray-500 text-lg">✕</button>
            </div>

            {detalle.proveedor_nombre && (
              <p className="text-sm text-gray-600 mb-3">
                Proveedor: <span className="font-medium">{detalle.proveedor_nombre}</span>
              </p>
            )}

            <div className="space-y-2 mb-4">
              {detalle.detalle.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-800">{item.producto_nombre}</p>
                    <p className="text-xs text-gray-400">
                      {item.presentacion_nombre && <span className="text-purple-600">{item.presentacion_nombre}</span>}
                      {item.presentacion_nombre && <span> · </span>}
                      {item.cantidad} × {formatGs(item.precio_unitario)}
                    </p>
                  </div>
                  <p className="font-medium">{formatGs(item.subtotal)}</p>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex justify-between font-bold text-gray-800">
              <span>TOTAL</span>
              <span className="text-emerald-600">{formatGs(detalle.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal nueva compra */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-800">Nueva compra</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select
                    value={form.proveedor_id}
                    onChange={e => setForm({ ...form, proveedor_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° factura proveedor</label>
                  <input
                    type="text"
                    value={form.numero_factura_proveedor}
                    onChange={e => setForm({ ...form, numero_factura_proveedor: e.target.value })}
                    placeholder="Ej: 001-001-0000123"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Productos</p>
                  <button
                    type="button"
                    onClick={agregarItem}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                  >
                    + Agregar ítem
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Encabezado: sin esto no se sabe que la ultima
                      columna es la suma de cantidad x precio. */}
                  <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-gray-500 uppercase">
                    <span className="col-span-3">Producto</span>
                    <span className="col-span-2">Presentación</span>
                    <span className="col-span-2">Cantidad</span>
                    <span className="col-span-2">Precio compra</span>
                    <span className="col-span-2 text-right">Subtotal</span>
                    <span className="col-span-1" />
                  </div>

                  {form.items.map((item, idx) => {
                    const prod = productos.find(p => p.id === Number(item.producto_id))
                    const presentaciones = prod?.presentaciones || []
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <SelectorProducto
                            productos={productos}
                            value={item.producto_id}
                            onChange={id => seleccionarProducto(idx, id)}
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={item.presentation_id}
                            onChange={e => actualizarItem(idx, 'presentation_id', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            disabled={!prod}
                          >
                            {presentaciones.length === 0 ? (
                              <option value="">Unidad</option>
                            ) : presentaciones.map(pres => (
                              <option key={pres.id} value={pres.id}>
                                {pres.nombre} ({pres.unidades_por_paquete} {prod?.unidad || 'u'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.cantidad}
                            onChange={e => actualizarItem(idx, 'cantidad', numeroDecimal(e.target.value))}
                            placeholder="Cant."
                            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.precio_unitario}
                            onChange={e => actualizarItem(idx, 'precio_unitario', numeroDecimal(e.target.value))}
                            placeholder="Precio compra"
                            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        {/* Cantidad x precio del renglon, en vivo */}
                        <div className="col-span-2 text-right">
                          <span className={`text-sm font-semibold tabular-nums ${subtotalItem(item) > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                            {subtotalItem(item) > 0 ? formatGs(subtotalItem(item)) : '—'}
                          </span>
                        </div>
                        <div className="col-span-1 text-center">
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => quitarItem(idx)}
                              className="text-gray-300 hover:text-red-500 text-lg"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex justify-between font-semibold text-gray-800">
                <span>Total estimado</span>
                <span className="text-emerald-600">{formatGs(totalCompra)}</span>
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {guardando ? 'Registrando...' : 'Registrar compra'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Compras