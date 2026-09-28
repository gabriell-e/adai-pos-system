import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatGs    = n  => `Gs. ${Number(n).toLocaleString('es-PY')}`
const formatFecha = f  => new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })

const TIPOS_PAGO = ['todos', 'efectivo', 'transferencia', 'qr', 'debito', 'mixto', 'fiado']
const STORAGE_KEY = 'adai_ventas_filtros'
const POR_PAGINA  = 100

const cargarFiltros = () => {
  try {
    const guardado = sessionStorage.getItem(STORAGE_KEY)
    if (guardado) return JSON.parse(guardado)
  } catch (_) {}
  return { busqueda: '', filtroTipo: 'todos', filtroEstado: 'todos', filtroFiado: 'todos' }
}

const Ventas = () => {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [ventas, setVentas]         = useState([])
  const [cargando, setCargando]     = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [pagina, setPagina]         = useState(1)
  const [hayMas, setHayMas]         = useState(false)
  const [meta, setMeta]             = useState({ total: 0, monto_total: 0, fiados_pendientes: 0 })

  const guardados = cargarFiltros()
  const [busqueda, setBusqueda]             = useState(guardados.busqueda)
  const [filtroTipo, setFiltroTipo]         = useState(guardados.filtroTipo)
  const [filtroEstado, setFiltroEstado]     = useState(guardados.filtroEstado)
  const [filtroFiado, setFiltroFiado]       = useState(guardados.filtroFiado)

  // Para no pedir la misma página dos veces
  const pedidoEnCurso = useRef(false)
  const pendienteRef  = useRef(null)
  const sentinelRef  = useRef(null)

  const construirParams = useCallback((pag) => {
    const p = { pagina: pag, por_pagina: POR_PAGINA }
    if (busqueda)     p.busqueda   = busqueda
    if (filtroTipo   !== 'todos') p.tipo_pago = filtroTipo
    if (filtroEstado !== 'todos') p.estado    = filtroEstado
    if (filtroFiado  !== 'todos') p.fiado     = filtroFiado
    return p
  }, [busqueda, filtroTipo, filtroEstado, filtroFiado])

  const cargarPagina = async (pag, { reemplazar }) => {
    // Si ya hay una petición en vuelo, no se pierde la nueva: se guarda
    // y se corre apenas termine la otra. Antes se descartaba y el usuario
    // quedaba viendo resultados de un filtro que ya había cambiado.
    if (pedidoEnCurso.current) {
      pendienteRef.current = { pag, reemplazar }
      return
    }
    pedidoEnCurso.current = true

    if (reemplazar) setCargando(true)
    else setCargandoMas(true)

    try {
      const { data } = await api.get('/ventas', { params: construirParams(pag) })

      setVentas(prev => reemplazar ? data.ventas : [...prev, ...data.ventas])
      setMeta({
        total: data.total,
        monto_total: data.monto_total,
        fiados_pendientes: data.fiados_pendientes
      })
      setHayMas(data.hay_mas)
      setPagina(pag)
    } catch (err) {
      console.error(err)
    } finally {
      pedidoEnCurso.current = false
      setCargando(false)
      setCargandoMas(false)

      const pendiente = pendienteRef.current
      if (pendiente) {
        pendienteRef.current = null
        cargarPagina(pendiente.pag, { reemplazar: pendiente.reemplazar })
      }
    }
  }

  // Guardar filtros para sobrevivir la navegación al detalle
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      busqueda, filtroTipo, filtroEstado, filtroFiado
    }))
  }, [busqueda, filtroTipo, filtroEstado, filtroFiado])

  // Carga inicial y recarga por cambio de filtro.
  // La búsqueda lleva debounce para no pegarle al servidor en cada tecla.
  const busquedaPrevia = useRef(busqueda)
  useEffect(() => {
    const cambioTexto = busquedaPrevia.current !== busqueda
    busquedaPrevia.current = busqueda
    const espera = cambioTexto ? 350 : 0
    const t = setTimeout(() => cargarPagina(1, { reemplazar: true }), espera)
    return () => clearTimeout(t)
  }, [construirParams])

  // Scroll infinito
  useEffect(() => {
    if (!sentinelRef.current || !hayMas || cargando || cargandoMas) return
    const obs = new IntersectionObserver(entradas => {
      if (entradas[0].isIntersecting) {
        cargarPagina(pagina + 1, { reemplazar: false })
      }
    }, { rootMargin: '300px' })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hayMas, cargando, cargandoMas, pagina])

  const cobrarFiado = async (venta) => {
    const confirmText = `Cobrar venta fiada?\n\nCliente: ${venta.cliente_nombre || 'Sin cliente'}\nMonto: ${formatGs(venta.total)}\n\n¿Confirmar cobro?`
    if (!confirm(confirmText)) return
    try {
      await api.patch(`/ventas/${venta.id}/cobrar`)
      cargarPagina(1, { reemplazar: true })
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cobrar')
    }
  }

  const badgePago = (v) => {
    if (v.tipo_pago === 'fiado') {
      if (v.fiado_pagada) return { text: 'Fiado Pagado', color: 'bg-blue-100 text-blue-700' }
      return { text: 'Fiado', color: 'bg-amber-100 text-amber-700' }
    }
    if (v.tipo_pago === 'mixto') return { text: 'Mixto', color: 'bg-purple-100 text-purple-700' }
    return { text: v.tipo_pago, color: 'bg-gray-100 text-gray-600' }
  }

  const hayFiltros = busqueda || filtroTipo !== 'todos' || filtroEstado !== 'todos' || filtroFiado !== 'todos'

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando ventas...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ventas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.total} ventas registradas
            {ventas.length < meta.total && ` · mostrando ${ventas.length}`}
          </p>
        </div>
        <Link
          to="/ventas/nueva"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nueva venta
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por factura o cliente..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          {TIPOS_PAGO.map(t => (
            <option key={t} value={t}>{t === 'todos' ? 'Todos los pagos' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="todos">Todos los estados</option>
          <option value="completada">Completadas</option>
          <option value="anulada">Anuladas</option>
        </select>
        <select value={filtroFiado} onChange={e => setFiltroFiado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="todos">Fiado: Todos</option>
          <option value="nofiado">Sin fiado</option>
          <option value="pendiente">Fiado pendiente</option>
          <option value="pagada">Fiado pagado</option>
        </select>
      </div>

      {/* Resumen — viene del servidor, sobre todas las ventas que cumplen el filtro */}
      {meta.total > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between text-sm">
          <span className="text-emerald-700">
            {meta.total} ventas
            {meta.fiados_pendientes > 0 && (
              <span className="ml-2 text-amber-600">· {meta.fiados_pendientes} fiados pendientes</span>
            )}
          </span>
          <span className="font-bold text-emerald-800">{formatGs(meta.monto_total)}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Factura</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Cajero</th>
              <th className="px-4 py-3 text-center">Pago</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-center">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {hayFiltros ? 'No se encontraron ventas con esos filtros' : 'Todavía no hay ventas registradas'}
                </td>
              </tr>
            ) : ventas.map(v => {
              const badge = badgePago(v)
              return (
                <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${v.estado === 'anulada' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{v.numero_factura || `#${v.id}`}</td>
                  <td className="px-4 py-3 text-gray-700">{v.cliente_nombre || <span className="text-gray-300">Consumidor final</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{v.cajero_nombre}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.color} capitalize`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{formatGs(v.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${v.estado === 'completada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      {v.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(v.creado_en)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Link to={`/ventas/${v.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Ver</Link>
                      {esAdmin && v.tipo_pago === 'fiado' && !v.fiado_pagada && v.estado === 'completada' && (
                        <button onClick={() => cobrarFiado(v)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                          Cobrar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Sentinel: dispara la carga de la siguiente tanda */}
        <div ref={sentinelRef} className="h-px" />

        {cargandoMas && (
          <p className="py-4 text-center text-sm text-gray-400">Cargando más ventas...</p>
        )}

        {!hayMas && ventas.length > 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            Fin de la lista · {ventas.length} de {meta.total}
          </p>
        )}
      </div>
    </div>
  )
}

export default Ventas
