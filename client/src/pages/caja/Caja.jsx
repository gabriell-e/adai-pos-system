import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatGs    = n => `Gs. ${Number(n).toLocaleString('es-PY')}`
const formatFecha = f => new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })

const Caja = () => {
  const { usuario }   = useAuth()
  const [cajaActiva, setCajaActiva]   = useState(null)
  const [historial, setHistorial]     = useState([])
  const [detalleId, setDetalleId]     = useState(null)
  const [detalle, setDetalle]         = useState(null)
  const [cargando, setCargando]       = useState(true)
  const [montoInicial, setMontoInicial] = useState('')
  const [montoFinal, setMontoFinal]   = useState('')
  const [cierreDatos, setCierreDatos] = useState(null)
  const [error, setError]             = useState('')

  const cargarDatos = async () => {
    try {
      const [activaRes, histRes] = await Promise.all([
        api.get('/caja/activa').catch(() => ({ data: null })),
        api.get('/caja')
      ])
      setCajaActiva(activaRes.data)
      setHistorial(histRes.data)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const verDetalle = async (id) => {
    setDetalleId(id)
    const { data } = await api.get(`/caja/${id}`)
    setDetalle(data)
  }

  const abrir = async () => {
    setError('')
    if (!montoInicial && montoInicial !== 0)
      return setError('Ingresá el monto inicial')
    if (!confirm(`¿Abrir caja con Gs. ${Number(montoInicial).toLocaleString('es-PY')} como monto inicial?`))
      return
    try {
      await api.post('/caja/abrir', {
        usuario_id:    usuario.id,
        monto_inicial: Number(montoInicial)
      })
      setMontoInicial('')
      await cargarDatos()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al abrir caja')
    }
  }

  const cerrar = async () => {
    setError('')
    if (!montoFinal && montoFinal !== 0)
      return setError('Ingresá el monto final contado')
    if (!confirm(`¿Cerrar caja con Gs. ${Number(montoFinal).toLocaleString('es-PY')} como monto final? Esta acción no se puede deshacer.`))
      return
    try {
      const { data } = await api.patch(`/caja/${cajaActiva.id}/cerrar`, {
        monto_final: Number(montoFinal)
      })
      setCierreDatos(data)
      setMontoFinal('')
      await cargarDatos()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cerrar caja')
    }
  }

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando caja...</p>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Caja</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control de apertura y cierre diario</p>
      </div>

      <div className="flex gap-6">
        {/* Panel principal */}
        <div className="flex-1 space-y-4">

          {/* Estado actual */}
          {cajaActiva ? (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-lg font-semibold text-gray-800">Caja abierta</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <p className="text-gray-500">Abierta por</p>
                  <p className="font-medium text-gray-800">{cajaActiva.usuario_nombre}</p>
                </div>
                <div>
                  <p className="text-gray-500">Hora de apertura</p>
                  <p className="font-medium text-gray-800">{formatFecha(cajaActiva.abierta_en)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Monto inicial</p>
                  <p className="font-medium text-gray-800">{formatGs(cajaActiva.monto_inicial)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Monto final contado (Gs.)</p>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={montoFinal}
                    onChange={e => setMontoFinal(e.target.value)}
                    placeholder="Ej: 250000"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                  />
                  <button
                    onClick={cerrar}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Cerrar caja
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 rounded-full bg-gray-300"></span>
                <h2 className="text-lg font-semibold text-gray-800">Caja cerrada</h2>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-2">Monto inicial (Gs.)</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={montoInicial}
                  onChange={e => setMontoInicial(e.target.value)}
                  placeholder="Ej: 100000"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  min="0"
                />
                <button
                  onClick={abrir}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Abrir caja
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Resumen de cierre */}
          {cierreDatos && (
            <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-emerald-200">
              <h3 className="font-semibold text-gray-800 mb-4">Resumen del día</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Monto inicial',       valor: cierreDatos.monto_inicial,   color: 'text-gray-700' },
                  { label: 'Total ventas del día', valor: cierreDatos.total_ventas,    color: 'text-gray-700' },
                  { label: 'Solo efectivo',        valor: cierreDatos.total_efectivo,  color: 'text-gray-700' },
                  { label: 'Costo de lo vendido',  valor: cierreDatos.costo_vendido,   color: 'text-red-500'  },
                  { label: 'Ganancia bruta',       valor: cierreDatos.ganancia_bruta,  color: 'text-emerald-600', bold: true },
                  { label: 'Efectivo esperado',    valor: cierreDatos.esperado,        color: 'text-gray-700' },
                  { label: 'Monto contado',        valor: cierreDatos.monto_final,     color: 'text-gray-700' },
                ].map(({ label, valor, color, bold }) => (
                  <div key={label} className="flex justify-between">
                    <span className={`text-gray-500 ${bold ? 'font-semibold' : ''}`}>{label}</span>
                    <span className={`${color} ${bold ? 'font-bold text-base' : 'font-medium'}`}>
                      {formatGs(valor)}
                    </span>
                  </div>
                ))}
                <div className={`flex justify-between pt-2 border-t font-semibold ${cierreDatos.diferencia >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span>Diferencia</span>
                  <span>{cierreDatos.diferencia >= 0 ? '+' : ''}{formatGs(cierreDatos.diferencia)}</span>
                </div>
              </div>
              <button
                onClick={() => setCierreDatos(null)}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600"
              >
                Cerrar resumen
              </button>
            </div>
          )}

          {/* Historial */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b">
              <p className="font-medium text-gray-700 text-sm">Historial de cajas</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Apertura</th>
                  <th className="px-4 py-3 text-left">Cierre</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-right">M. Inicial</th>
                  <th className="px-4 py-3 text-right">M. Final</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Sin historial de cajas
                    </td>
                  </tr>
                ) : historial.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => verDetalle(c.id)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${detalleId === c.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-600 text-xs">{formatFecha(c.abierta_en)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.cerrada_en ? formatFecha(c.cerrada_en) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{c.usuario_nombre}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatGs(c.monto_inicial)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.monto_final ? formatGs(c.monto_final) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.estado === 'abierta' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel detalle caja */}
        {detalle && (
          <div className="w-80 space-y-4 self-start">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-start mb-4">
                <p className="font-semibold text-gray-800">Detalle de caja</p>
                <button onClick={() => { setDetalleId(null); setDetalle(null) }} className="text-gray-300 hover:text-gray-500 text-lg">✕</button>
              </div>

              <div className="space-y-2 text-sm mb-4">
                {[
                  { label: 'Total ventas',   valor: detalle.total_ventas  },
                  { label: 'M. inicial',     valor: detalle.monto_inicial },
                  { label: 'M. final',       valor: detalle.monto_final   },
                ].map(({ label, valor }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800">{valor != null ? formatGs(valor) : <span className="text-gray-300">—</span>}</span>
                  </div>
                ))}
              </div>

              {/* Resumen por tipo de pago */}
              {detalle.resumen?.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Por tipo de pago</p>
                  <div className="space-y-1">
                    {detalle.resumen.map(r => (
                      <div key={r.tipo_pago} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{r.tipo_pago} ({r.cantidad})</span>
                        <span className="font-medium text-gray-800">{formatGs(r.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ventas del período */}
            {detalle.ventas?.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Ventas ({detalle.ventas.length})
                  </p>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {detalle.ventas.map(v => (
                    <div key={v.id} className="px-4 py-2 flex justify-between text-sm">
                      <div>
                        <p className="text-gray-700 font-mono text-xs">{v.numero_factura || `#${v.id}`}</p>
                        <p className="text-gray-400 text-xs capitalize">{v.tipo_pago}</p>
                      </div>
                      <p className="font-medium text-gray-800">{formatGs(v.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Caja