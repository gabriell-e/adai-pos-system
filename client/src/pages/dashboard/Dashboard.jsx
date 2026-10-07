import { useState, useEffect, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

// recharts pesa ~430 kB, se carga aparte para no frenar el arranque
const Graficas = lazy(() => import('./Graficas'))

const formatGs    = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`
const formatFecha = f => new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })

// `grande` agranda el número para los montos que se leen de un vistazo. Sin
// él queda igual que los otros cuadros, con el mismo tamaño de fuente.
// El monto grande baja un escalón en pantallas chicas y puede partirse, porque
// en guaraníes un total de siete u ocho dígitos no entra en un solo renglón.
const Stat = ({ label, valor, sub, color = 'text-gray-800', grande = false }) => (
  <div className="bg-white rounded-xl shadow-sm p-5">
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className={`font-bold break-words ${grande ? 'text-3xl sm:text-4xl leading-tight' : 'text-2xl'} ${color}`}>{valor}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

// Desglose de cómo se cobró el día. El local pidió ver efectivo, transferencia
// y deuda por separado, con la suma y el total.
//
// "Otros" solo aparece si hay algo: las ventas pueden pagarse con QR, débito o
// tarjeta, y si se omitieran el total de abajo no cerraría con "Ventas hoy".
const StatPagos = ({ lineas, total }) => {
  const conDatos = lineas.filter(l => l.monto > 0)
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-2">Cobrado hoy por medio</p>
      <div className="space-y-1">
        {conDatos.length === 0 ? (
          <p className="text-sm text-gray-400">Sin ventas hoy</p>
        ) : conDatos.map(l => (
          <div key={l.clave} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{l.etiqueta}</span>
            <span className={`font-medium ${l.clase}`}>{formatGs(l.monto)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t mt-2 pt-2">
        <span className="text-sm text-gray-500">Total</span>
        <span className="font-bold text-gray-800">{formatGs(total)}</span>
      </div>
    </div>
  )
}

const Dashboard = () => {
  const [ventas, setVentas]           = useState([])
  const [lowStock, setLowStock]       = useState([])
  const [cajaActiva, setCajaActiva]   = useState(null)
  const [cargando, setCargando]       = useState(true)

  // El local pidió ver el mes en curso, no una ventana de días.
  const [periodo, setPeriodo]         = useState('mes')
  const [graf, setGraf]               = useState(null)
  const [cargandoGraf, setCargandoGraf] = useState(true)

  // 'monto' muestra el total de ventas grande y la cantidad abajo (lo que
  // pidió el local). 'cantidad' es el orden anterior: cantidad grande, total
  // abajo, con el ticket promedio al lado.
  const [ordenVentas, setOrdenVentas] = useState('monto')

  const [consumosHoy, setConsumosHoy] = useState([])
  const [gastosHoy, setGastosHoy]     = useState(0)

  useEffect(() => {
    const cargar = async () => {
      const [ventasHoyRes, stockRes, cajaRes, consumoRes, gastosRes] = await Promise.all([
        api.get('/ventas/hoy'),
        api.get('/productos/low-stock'),
        api.get('/caja/activa').catch(() => ({ data: null })),
        api.get('/consumo').catch(() => ({ data: [] })),
        api.get('/gastos/resumen').catch(() => ({ data: null }))
      ])
      setVentas(ventasHoyRes.data)
      setLowStock(stockRes.data)
      setCajaActiva(cajaRes.data)
      setConsumosHoy(consumoRes.data)
      setGastosHoy(gastosRes.data?.hoy?.total || 0)
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

  // Consumo propio de hoy, a precio de compra (que es lo que sale de la caja).
  // El endpoint devuelve producto_precio_compra junto con la cantidad.
  const consumoHoy = consumosHoy
    .filter(c => new Date(c.creado_en).toLocaleDateString('es-PY') === hoy)
    .reduce((acc, c) => acc + (c.cantidad * (c.producto_precio_compra || 0)), 0)

  // Lo que realmente queda del día. La ganancia sola (ventas - costo de los
  // productos) miente: el consumo propio y los gastos salen de la caja igual que
  // una venta, así que se restan acá, igual que hace el resumen del período.
  const resultadoHoy = gananciaNetaHoy - gastosHoy - consumoHoy

  // Solo se mencionan los rubros que hubo, para no escribir "Gastos Gs. 0".
  const formulaHoy = ['Ventas - Costos',
    gastosHoy > 0 ? `Gastos ${formatGs(gastosHoy)}` : null,
    consumoHoy > 0 ? `Consumo ${formatGs(consumoHoy)}` : null
  ].filter(Boolean).join(' - ')

  // Desglose visual de la ganancia neta del día, igual que "Cobrado hoy por medio"
  const gananciaDetalle = (() => {
    const vCosto = gananciaNetaHoy  // ventas - costo
    const gastos  = gastosHoy
    const consumo = consumoHoy
    const lineas  = []

    if (vCosto !== 0) {
      lineas.push({ clave: 'vcosto', etiqueta: 'Ventas - Costos', monto: vCosto, clase: vCosto >= 0 ? 'text-emerald-600' : 'text-red-600' })
    }
    if (gastos > 0) {
      lineas.push({ clave: 'gastos', etiqueta: 'Gastos', monto: -gastos, clase: 'text-red-600' })
    }
    if (consumo > 0) {
      lineas.push({ clave: 'consumo', etiqueta: 'Consumo propio', monto: -consumo, clase: 'text-red-600' })
    }

    const total = vCosto - gastos - consumo
    return { lineas, total }
  })()

  // Desglose del día por medio de pago.
  //
  // Las ventas mixtas guardan el reparto en pago_detalle, que viene como texto
  // JSON. Sin abrirlo, una venta de 5.000 en efectivo y 2.500 por transferencia
  // caería entera en "otros" y ni el efectivo ni la transferencia la sumarían.
  const pagoDetalleDe = (venta) => {
    if (!venta.pago_detalle) return null
    if (typeof venta.pago_detalle === 'object') return venta.pago_detalle
    try {
      const d = JSON.parse(venta.pago_detalle)
      return Array.isArray(d) && d.length ? d : null
    } catch (_) {
      return null
    }
  }

  const pagos = (() => {
    const t = { efectivo: 0, transferencia: 0, deuda: 0, otros: 0 }
    for (const v of ventasHoy) {
      if (v.tipo_pago === 'fiado') { t.deuda += v.total; continue }

      const detalle = pagoDetalleDe(v)
      if (detalle) {
        for (const p of detalle) {
          if (p.tipo === 'efectivo')         t.efectivo     += p.monto || 0
          else if (p.tipo === 'transferencia') t.transferencia += p.monto || 0
          else if (p.tipo === 'fiado')        t.deuda        += p.monto || 0
          else                                t.otros        += p.monto || 0
        }
        continue
      }

      if (v.tipo_pago === 'efectivo')          t.efectivo     += v.total
      else if (v.tipo_pago === 'transferencia') t.transferencia += v.total
      else if (v.tipo_pago === 'fiado')         t.deuda        += v.total
      else                                     t.otros        += v.total
    }
    return t
  })()

  const pagosTotal = pagos.efectivo + pagos.transferencia + pagos.deuda + pagos.otros

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
    const consumo = new Map((graf.consumo_por_dia || []).map(c => [c.dia, c.monto]))

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
        gastos: gastos.get(dia) || 0,
        consumo: consumo.get(dia) || 0
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
        {/* El local prefiere ver el monto en grande y la cantidad de ventas
            abajo, al revés de como estaba. Con el switch se vuelve al orden
            anterior sin tocar el código. */}
        <Stat
          label="Ventas hoy"
          valor={ordenVentas === 'monto' ? formatGs(totalHoy) : ventasHoy.length}
          sub={ordenVentas === 'monto'
            ? `${ventasHoy.length} ventas`
            : `Total: ${formatGs(totalHoy)}`}
          color="text-emerald-600"
          grande={ordenVentas === 'monto'}
        />
        <StatPagos
          lineas={[
            { clave: 'efectivo',     etiqueta: 'Efectivo',      monto: pagos.efectivo,     clase: 'text-emerald-600' },
            { clave: 'transferencia', etiqueta: 'Transferencia', monto: pagos.transferencia, clase: 'text-blue-600' },
            { clave: 'deuda',        etiqueta: 'Deuda',         monto: pagos.deuda,        clase: 'text-amber-600' },
            { clave: 'otros',        etiqueta: 'Otros',         monto: pagos.otros,        clase: 'text-purple-600' }
          ]}
          total={pagosTotal}
        />
        <Stat label="Fiado pendiente" valor={formatGs(fiadoPendiente)} sub={`${ventasFiado.length} ventas sin cobrar`} color={fiadoPendiente > 0 ? 'text-amber-600' : 'text-gray-800'} />
        <Stat
          label="Ganancia neta hoy"
          valor={formatGs(resultadoHoy)}
          sub={formulaHoy}
          color={resultadoHoy >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
      </div>

      {/* Gráficas */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-gray-800">Gráficas</h2>
        <div className="flex items-center gap-2">
          {/* Switch del orden de "Ventas hoy" */}
          <button
            onClick={() => setOrdenVentas(o => (o === 'monto' ? 'cantidad' : 'monto'))}
            className="text-xs text-gray-500 hover:text-emerald-700 font-medium px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Cambiar entre total grande y cantidad de ventas"
          >
            {ordenVentas === 'monto' ? 'Ver cantidad de ventas' : 'Ver total de ventas'}
          </button>
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
            <Stat
              label="Ventas del período"
              valor={formatGs(graf.resumen.monto_ventas)}
              sub={`${graf.resumen.cantidad_ventas} ventas`}
              color="text-emerald-600"
            />
            {/* Antes iba el ticket promedio acá, pero no se usa para decidir
                nada. El consumo propio sí: son productos que salen del local
                sin generar venta, y eso se ve en el resultado final. */}
            <Stat
              label="Consumo propio"
              valor={formatGs(graf.resumen.total_consumo)}
              sub={graf.resumen.unidades_consumo > 0
                ? `${graf.resumen.unidades_consumo} unidades a precio de compra`
                : 'Sin consumo en el período'}
              color={graf.resumen.total_consumo > 0 ? 'text-purple-600' : 'text-gray-800'}
            />
            <Stat label="Gastos personales" valor={formatGs(graf.resumen.total_gastos)} sub="Del período" color="text-red-500" />
            <Stat
              label="Tras gastos y consumo"
              valor={formatGs(graf.resumen.resultado_tras_gastos)}
              sub="Ventas - gastos - consumo"
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
