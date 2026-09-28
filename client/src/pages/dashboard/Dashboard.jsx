import { useState, useEffect, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

// recharts pesa ~430 kB, se carga aparte para no frenar el arranque
const Graficas = lazy(() => import('./Graficas'))

const formatGs    = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`
const formatFecha = f => new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })

const Stat = ({ label, valor, sub, color = 'text-gray-800' }) => (
  <div className="bg-white rounded-xl shadow-sm p-5">
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{valor}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

const Dashboard = () => {
  const [ventas, setVentas]           = useState([])
  const [lowStock, setLowStock]       = useState([])
  const [cajaActiva, setCajaActiva]   = useState(null)
  const [cargando, setCargando]       = useState(true)

  const [periodo, setPeriodo]         = useState('7dias')
  const [graf, setGraf]               = useState(null)
  const [cargandoGraf, setCargandoGraf] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const [ventasHoyRes, stockRes, cajaRes] = await Promise.all([
        api.get('/ventas/hoy'),
        api.get('/productos/low-stock'),
        api.get('/caja/activa').catch(() => ({ data: null }))
      ])
      setVentas(ventasHoyRes.data)
      setLowStock(stockRes.data)
      setCajaActiva(cajaRes.data)
      setCargando(false)
    }
    cargar()
  }, [])

  useEffect(() => {
    setCargandoGraf(true)
    api.get('/reportes/graficas', { params: { periodo } })
      .then(({ data }) => setGraf(data))
      .catch(() => setGraf(null))
      .finally(() => setCargandoGraf(false))
  }, [periodo])

  const hoy       = new Date().toLocaleDateString('es-PY')
  const ventasHoy = ventas.filter(v => {
    const f = new Date(v.creado_en).toLocaleDateString('es-PY')
    return f === hoy && v.estado === 'completada'
  })
  const totalHoy    = ventasHoy.reduce((acc, v) => acc + v.total, 0)
  const ventasFiado = ventasHoy.filter(v => v.tipo_pago === 'fiado' && !v.fiado_pagada)
  const fiadoPendiente = ventasFiado.reduce((acc, v) => acc + v.total, 0)
  const gananciaNetaHoy = ventasHoy.reduce((acc, v) => acc + (v.total - (v.costo_total || 0)), 0)

  // Ventas y gastos por día, juntos para poder comparar
  //
  // El backend solo devuelve los días que tienen movimiento, así que se arma la
  // serie completa desde el inicio del período hasta hoy, con cero en los días
  // sin ventas. Si no, un día con una venta y un día con cien quedan a la misma
  // distancia en el eje, y el gráfico no dice nada.
  const serieDiaria = (() => {
    if (!graf) return []
    const ventas = new Map(graf.por_dia.map(d => [d.dia, d.monto]))
    const gastos = new Map(graf.gastos_por_dia.map(g => [g.dia, g.monto]))

    // 'AAAA-MM-DD' -> 'DD/MM'. Antes se recortaba con slice(5) y quedaba
    // 'MM-DD' (formato americano), y al ordenar por esa etiqueta los meses
    // quedaban mezclados.
    const etiqueta = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`

    const hoy = new Date().toLocaleDateString('sv-SE')
    const serie = []
    let dia = graf.desde
    // Tope de seguridad por si 'desde' viniera mal y el bucle no termine
    for (let i = 0; i <= 400 && dia <= hoy; i++) {
      serie.push({
        dia: etiqueta(dia),
        fecha: dia,
        ventas: ventas.get(dia) || 0,
        gastos: gastos.get(dia) || 0
      })
      // Mediodía en UTC para que el cambio de día no se corra por la zona
      const f = new Date(`${dia}T12:00:00Z`)
      f.setUTCDate(f.getUTCDate() + 1)
      dia = f.toISOString().slice(0, 10)
    }
    return serie
  })()

  const datosGraficas = graf && {
    serieDiaria,
    periodo: graf.periodo,
    datosPago:   graf.por_pago.map(p => ({ name: p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1), value: p.monto })),
    datosHora:   graf.por_hora.map(h => ({ hora: `${h.hora}h`, monto: h.monto })),
    datosProductos: graf.top_productos.map(p => ({
      nombre: p.nombre.length > 18 ? `${p.nombre.slice(0, 18)}…` : p.nombre,
      monto: p.monto
    }))
  }

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando dashboard...</p>
    </div>
  )

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Estado de caja */}
      <div className={`rounded-xl px-4 py-3 flex items-center justify-between text-sm
        ${cajaActiva
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-yellow-50 border border-yellow-200'}`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cajaActiva ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-400'}`}></span>
          <span className={cajaActiva ? 'text-emerald-700' : 'text-yellow-700'}>
            {cajaActiva
              ? `Caja abierta desde ${formatFecha(cajaActiva.abierta_en)}`
              : 'No hay caja abierta hoy'}
          </span>
        </div>
        <Link
          to="/caja"
          className={`text-xs font-medium ${cajaActiva ? 'text-emerald-600 hover:text-emerald-800' : 'text-yellow-600 hover:text-yellow-800'}`}
        >
          {cajaActiva ? 'Ver caja →' : 'Abrir caja →'}
        </Link>
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Ventas hoy" valor={ventasHoy.length} sub={`Total: ${formatGs(totalHoy)}`} color="text-emerald-600" />
        <Stat label="Ticket promedio" valor={ventasHoy.length > 0 ? formatGs(Math.round(totalHoy / ventasHoy.length)) : '—'} sub="Por venta" />
        <Stat label="Fiado pendiente" valor={formatGs(fiadoPendiente)} sub={`${ventasFiado.length} ventas sin cobrar`} color={fiadoPendiente > 0 ? 'text-amber-600' : 'text-gray-800'} />
        <Stat label="Ganancia neta hoy" valor={formatGs(gananciaNetaHoy)} sub="Ventas - Costos" color={gananciaNetaHoy >= 0 ? 'text-emerald-600' : 'text-red-600'} />
      </div>

      {/* Gráficas */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Gráficas</h2>
        <select
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="hoy">Hoy</option>
          <option value="7dias">Últimos 7 días</option>
          <option value="30dias">Últimos 30 días</option>
          <option value="mes">Mes actual</option>
        </select>
      </div>

      {cargandoGraf ? (
        <div className="bg-white rounded-xl shadow-sm h-80 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Cargando gráficas...</p>
        </div>
      ) : !graf || serieDiaria.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
          No hay ventas en este período
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Ventas del período" valor={formatGs(graf.resumen.monto_ventas)} sub={`${graf.resumen.cantidad_ventas} ventas`} color="text-emerald-600" />
            <Stat label="Ticket promedio" valor={formatGs(graf.resumen.ticket_promedio)} sub={graf.periodo} />
            <Stat label="Gastos personales" valor={formatGs(graf.resumen.total_gastos)} sub="Del período" color="text-red-500" />
            <Stat
              label="Tras gastos"
              valor={formatGs(graf.resumen.resultado_tras_gastos)}
              sub="Ventas - gastos"
              color={graf.resumen.resultado_tras_gastos >= 0 ? 'text-emerald-600' : 'text-red-600'}
            />
          </div>

          <Suspense fallback={
            <div className="bg-white rounded-xl shadow-sm h-80 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Cargando gráficas...</p>
            </div>
          }>
            <Graficas datos={datosGraficas} />
          </Suspense>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Últimas ventas */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="font-medium text-gray-700 text-sm">Últimas ventas</p>
            <Link to="/ventas" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Ver todas →</Link>
          </div>
          {ventasHoy.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">Sin ventas registradas</div>
          ) : (
            <div className="divide-y">
              {ventasHoy.slice(0, 8).map(v => (
                <Link key={v.id} to={`/ventas/${v.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.cliente_nombre || 'Consumidor final'}</p>
                    <p className="text-xs text-gray-400">{v.numero_factura || `#${v.id}`} · {formatFecha(v.creado_en)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{formatGs(v.total)}</p>
                    <p className="text-xs text-gray-400 capitalize">{v.tipo_pago}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stock bajo */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="font-medium text-gray-700 text-sm">
              Stock bajo
              {lowStock.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {lowStock.length}
                </span>
              )}
            </p>
            <Link to="/productos" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">Ver →</Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">✅ Todo con stock suficiente</div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto">
              {lowStock.slice(0, 9).map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.categoria_nombre || '—'}</p>
                  </div>
                  <span className="inline-block bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                    {p.stock} {p.unidad || 'u'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default Dashboard
