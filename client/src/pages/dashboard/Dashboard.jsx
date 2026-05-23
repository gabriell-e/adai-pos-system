import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

const formatGs    = n => `Gs. ${Number(n).toLocaleString('es-PY')}`
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
  const [inventario, setInventario]   = useState(null)
  const [cajaActiva, setCajaActiva]   = useState(null)
  const [cargando, setCargando]       = useState(true)

  useEffect(() => {
    const cargar = async () => {
      const [ventasRes, stockRes, invRes, cajaRes] = await Promise.all([
        api.get('/ventas'),
        api.get('/productos/low-stock'),
        api.get('/productos/inventario/valor'),
        api.get('/caja/activa').catch(() => ({ data: null }))
      ])
      setVentas(ventasRes.data)
      setLowStock(stockRes.data)
      setInventario(invRes.data)
      setCajaActiva(cajaRes.data)
      setCargando(false)
    }
    cargar()
  }, [])

  // Ventas de hoy
  const hoy       = new Date().toLocaleDateString('es-PY')
  const ventasHoy = ventas.filter(v => {
    const fecha = new Date(v.creado_en).toLocaleDateString('es-PY')
    return fecha === hoy && v.estado === 'completada'
  })
  const totalHoy  = ventasHoy.reduce((acc, v) => acc + v.total, 0)

  // Últimas 5 ventas
  const ultimasVentas = ventas
    .filter(v => v.estado === 'completada')
    .slice(0, 5)

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

      {/* Alerta timbrado si no hay config */}
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

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Ventas hoy"
          valor={ventasHoy.length}
          sub={`Total: ${formatGs(totalHoy)}`}
          color="text-emerald-600"
        />
        <Stat
          label="Valor inventario (venta)"
          valor={formatGs(inventario?.resumen?.valor_venta || 0)}
          sub={`${inventario?.resumen?.total_productos || 0} productos activos`}
        />
        <Stat
          label="Valor inventario (compra)"
          valor={formatGs(inventario?.resumen?.valor_compra || 0)}
          sub="Costo real del stock"
        />
        <Stat
          label="Ganancia potencial"
          valor={formatGs(inventario?.resumen?.ganancia_potencial || 0)}
          sub="Si se vende todo el stock"
          color="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Últimas ventas */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="font-medium text-gray-700 text-sm">Últimas ventas</p>
            <Link to="/ventas" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
              Ver todas →
            </Link>
          </div>
          {ultimasVentas.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              Sin ventas registradas
            </div>
          ) : (
            <div className="divide-y">
              {ultimasVentas.map(v => (
                <Link
                  key={v.id}
                  to={`/ventas/${v.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {v.cliente_nombre || 'Consumidor final'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {v.numero_factura || `#${v.id}`} · {formatFecha(v.creado_en)}
                    </p>
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
            <Link to="/productos" className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
              Ver productos →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              ✅ Todos los productos tienen stock suficiente
            </div>
          ) : (
            <div className="divide-y">
              {lowStock.slice(0, 6).map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.categoria_nombre || 'Sin categoría'}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {p.stock} {p.unidad}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">Mín: {p.stock_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventario por categoría */}
        {inventario?.por_categoria?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 border-b">
              <p className="font-medium text-gray-700 text-sm">Inventario por categoría</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-center">Productos</th>
                    <th className="px-4 py-3 text-right">Valor compra</th>
                    <th className="px-4 py-3 text-right">Valor venta</th>
                    <th className="px-4 py-3 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventario.por_categoria.map(c => {
                    const margen = c.valor_compra > 0
                      ? (((c.valor_venta - c.valor_compra) / c.valor_compra) * 100).toFixed(1)
                      : 0
                    return (
                      <tr key={c.categoria} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.categoria}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{c.productos}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatGs(c.valor_compra)}</td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">{formatGs(c.valor_venta)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold ${margen > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                            +{margen}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard