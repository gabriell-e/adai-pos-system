import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { buscarProductos } from '../../utils/buscar'
import { numeroDecimal } from '../../utils/validar'

const formatGs = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`

const Stat = ({ label, valor, color = 'text-gray-800' }) => (
  <div className="bg-white rounded-xl shadow-sm p-4">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{valor}</p>
  </div>
)

const Consumo = () => {
  const { usuario } = useAuth()

  const [productos, setProductos]       = useState([])
  const [consumos, setConsumos]         = useState([])
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState('')

  const [busqueda, setBusqueda]         = useState('')
  const [resultados, setResultados]     = useState([])
  const [totalResultados, setTotalResultados] = useState(0)
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const busquedaRef                     = useRef()

  const [cantidad, setCantidad]         = useState('')
  const [motivo, setMotivo]             = useState('')
  const [enviando, setEnviando]         = useState(false)

  const [filtroFecha, setFiltroFecha]   = useState('todos')

  const cargarDatos = async () => {
    try {
      const [prodRes, consRes] = await Promise.all([
        api.get('/productos'),
        api.get('/consumo')
      ])
      setProductos(prodRes.data.filter(p => p.activo === 1))
      setConsumos(consRes.data)
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return setTotalResultados(0) }
    // Mismo orden por prioridad que el buscador de productos: al escribir
    // "leche" tiene que salir primero "Leche", no "Crema de leche".
    const todos = buscarProductos(productos, busqueda)
    setTotalResultados(todos.length)
    setResultados(todos.slice(0, 8))
  }, [busqueda, productos])

  const seleccionarProducto = (p) => {
    setProductoSeleccionado(p)
    setBusqueda(p.nombre)
    setResultados([])
    setCantidad('')
    setError('')
  }

  const limpiarProducto = () => {
    setProductoSeleccionado(null)
    setBusqueda('')
    setCantidad('')
    setMotivo('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!productoSeleccionado) return setError('Seleccioná un producto')
    const cant = parseFloat(numeroDecimal(cantidad))
    if (!cant || cant <= 0) return setError('Ingresá una cantidad válida')
    if (cant > productoSeleccionado.stock) return setError(`Stock disponible: ${productoSeleccionado.stock}`)

    setEnviando(true)
    try {
      await api.post('/consumo', {
        producto_id: productoSeleccionado.id,
        usuario_id:  usuario.id,
        cantidad:    cant,
        motivo:      motivo.trim() || null
      })
      await cargarDatos()
      limpiarProducto()
      busquedaRef.current?.focus()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar consumo')
    } finally {
      setEnviando(false)
    }
  }

  const anular = async (id) => {
    if (!confirm('¿Anular este consumo? Se revertirá el stock.')) return
    try {
      await api.delete(`/consumo/${id}/anular`)
      await cargarDatos()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al anular')
    }
  }

  const formatCantidad = (item) => {
    const n = Number(item.cantidad)
    const u = item.producto_unidad || 'unidad'
    if (u === 'unidad') return Number.isInteger(n) ? n : n.toFixed(2)
    return `${n.toFixed(2)} ${u === 'kg' ? 'kg' : u === 'litro' ? 'L' : 'g'}`
  }

  // ── Cálculos por período ──────────────────────────────────────────
  const filtrarPorPeriodo = (lista, periodo) => {
    const ahora = new Date()
    if (periodo === 'hoy') {
      const hoy = ahora.toLocaleDateString('es-PY')
      return lista.filter(c => new Date(c.creado_en).toLocaleDateString('es-PY') === hoy)
    }
    if (periodo === 'semana') {
      const inicio = new Date(ahora)
      inicio.setDate(ahora.getDate() - ahora.getDay())
      inicio.setHours(0, 0, 0, 0)
      return lista.filter(c => new Date(c.creado_en) >= inicio)
    }
    if (periodo === 'mes') {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return lista.filter(c => new Date(c.creado_en) >= inicio)
    }
    return lista
  }

  const consumosHoy = filtrarPorPeriodo(consumos, 'hoy')
  const consumosSemana = filtrarPorPeriodo(consumos, 'semana')
  const consumosMes = filtrarPorPeriodo(consumos, 'mes')

  // El consumo se mide a precio de compra, no a precio de venta. No hubo
  // venta, asi que la plata que salio de la caja es la que costo comprar esos
  // productos. Antes se multiplicaba por el precio de venta y el numero no
  // cuadraba con el del dashboard, que ya usa costo.
  const costo = (lista) => lista.reduce((acc, c) => acc + (c.producto_precio_compra || 0) * c.cantidad, 0)

  const consumosFiltrados = filtrarPorPeriodo(consumos, filtroFecha)

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando...</p>
    </div>
  )

  return (
    <div className="flex gap-6 h-full">

      {/* ── Columna izquierda: formulario + stats ── */}
      <div className="flex-1 flex flex-col gap-4">

        <div>
          <h1 className="text-2xl font-bold text-gray-800">Consumo Propio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Registrá productos retirados para uso interno</p>
        </div>

        {/* Costo del consumo, a precio de compra */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Costo hoy" valor={formatGs(costo(consumosHoy))} color="text-red-600" />
          <Stat label="Costo semana" valor={formatGs(costo(consumosSemana))} color="text-red-600" />
          <Stat label="Costo mes" valor={formatGs(costo(consumosMes))} color="text-red-700" />
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 space-y-4">

          {/* Búsqueda producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Producto *</label>
            {productoSeleccionado ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-emerald-800">{productoSeleccionado.nombre}</p>
                  <p className="text-xs text-emerald-600">
                    Stock: {productoSeleccionado.stock} · {formatGs(productoSeleccionado.precio_venta)}
                  </p>
                </div>
                <button type="button" onClick={limpiarProducto} className="text-emerald-400 hover:text-emerald-600 text-lg">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={busquedaRef}
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                {resultados.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                    <div className="max-h-80 overflow-y-auto">
                    {resultados.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => seleccionarProducto(p)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-emerald-50 text-left border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                          <p className="text-xs text-gray-400">
                            Stock: <span className={p.stock <= p.stock_minimo ? 'text-red-500 font-medium' : ''}>{p.stock}</span>
                            {' · '}{p.unidad || 'unidad'}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-600">{formatGs(p.precio_venta)}</p>
                      </button>
                    ))}
                    </div>
                    {totalResultados > resultados.length && (
                      <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
                        {totalResultados} coincidencias, se muestran las primeras {resultados.length}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cantidad *
                {productoSeleccionado && (
                  <span className="text-gray-400 font-normal"> ({productoSeleccionado.unidad || 'unidad'})</span>
                )}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={cantidad}
                onChange={e => setCantidad(numeroDecimal(e.target.value))}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Para la casa"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={enviando || !productoSeleccionado}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {enviando ? 'Registrando...' : 'Registrar consumo'}
            </button>
          </div>
        </form>

        {/* ── Historial ── */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Historial de consumos</h2>
            <select
              value={filtroFecha}
              onChange={e => setFiltroFecha(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Esta semana</option>
              <option value="mes">Este mes</option>
            </select>
          </div>
          {consumosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <p className="text-sm">No hay consumos en este período</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-2 bg-gray-50 border-b flex items-center justify-between text-xs">
                <span className="text-gray-500">{consumosFiltrados.length} registros</span>
                <span className="font-semibold text-red-600">Costo: {formatGs(costo(consumosFiltrados))}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-center">Cantidad</th>
                    <th className="px-4 py-3 text-right">P. Compra</th>
                    <th className="px-4 py-3 text-right">Costo</th>
                    <th className="px-4 py-3 left">Motivo</th>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-center w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consumosFiltrados.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.producto_nombre}</td>
                      <td className="px-4 py-3 text-center">{formatCantidad(c)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatGs(c.producto_precio_compra)}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {formatGs((c.producto_precio_compra || 0) * c.cantidad)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.motivo || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.creado_en}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => anular(c.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Anular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

      </div>

    </div>
  )
}

export default Consumo
