import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api/axios'

const formatGs = n => `Gs. ${Number(n).toLocaleString('es-PY')}`

const DetalleVenta = () => {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [venta, setVenta]     = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get(`/ventas/${id}`)
      .then(res => setVenta(res.data))
      .catch(() => navigate('/ventas'))
      .finally(() => setCargando(false))
  }, [id])

  const anular = async () => {
    if (!confirm('¿Anular esta venta? Se revertirá el stock.')) return
    try {
      await api.patch(`/ventas/${id}/anular`)
      setVenta(prev => ({ ...prev, estado: 'anulada' }))
    } catch (err) {
      alert(err.response?.data?.error || 'Error al anular')
    }
  }

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando venta...</p>
    </div>
  )

  if (!venta) return null

  return (
    <div className="max-w-2xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">
              Factura {venta.numero_factura || `#${venta.id}`}
            </h1>
            <span className={`
              px-2 py-0.5 rounded-full text-xs font-medium
              ${venta.estado === 'completada'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'}
            `}>
              {venta.estado}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{venta.creado_en}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/ventas/nueva"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Nueva venta
          </Link>
          {venta.estado === 'completada' && (
            <button
              onClick={anular}
              className="border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Anular
            </button>
          )}
        </div>
      </div>

      {/* Info general */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Cliente</p>
          <p className="font-medium text-gray-800">{venta.cliente_nombre || 'Consumidor final'}</p>
          {venta.cliente_ruc_ci && <p className="text-gray-400 text-xs">{venta.cliente_ruc_ci}</p>}
        </div>
        <div>
          <p className="text-gray-500">Cajero</p>
          <p className="font-medium text-gray-800">{venta.cajero_nombre}</p>
        </div>
        <div>
          <p className="text-gray-500">Tipo de pago</p>
          <p className="font-medium text-gray-800 capitalize">{venta.tipo_pago}</p>
        </div>
        <div>
          <p className="text-gray-500">Condición</p>
          <p className="font-medium text-gray-800 capitalize">{venta.condicion_venta}</p>
        </div>
        {venta.timbrado && (
          <div>
            <p className="text-gray-500">Timbrado</p>
            <p className="font-medium text-gray-800">{venta.timbrado}</p>
          </div>
        )}
      </div>

      {/* Detalle productos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-center">Cant.</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {venta.detalle.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{item.producto_nombre}</p>
                  <p className="text-xs text-gray-400">IVA {item.tasa_iva}%</p>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{item.cantidad}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatGs(item.precio_unitario)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatGs(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-2 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal gravado 10%</span>
          <span>{formatGs(venta.subtotal_gravado_10)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>IVA 10%</span>
          <span>{formatGs(venta.iva_10)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Subtotal gravado 5%</span>
          <span>{formatGs(venta.subtotal_gravado_5)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>IVA 5%</span>
          <span>{formatGs(venta.iva_5)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Subtotal exento</span>
          <span>{formatGs(venta.subtotal_exento)}</span>
        </div>
        {venta.descuento > 0 && (
          <div className="flex justify-between text-orange-500">
            <span>Descuento</span>
            <span>- {formatGs(venta.descuento)}</span>
          </div>
        )}
        <div className="border-t pt-3 flex justify-between font-bold text-base text-gray-800">
          <span>TOTAL</span>
          <span className="text-emerald-600">{formatGs(venta.total)}</span>
        </div>
        {venta.vuelto > 0 && (
          <div className="flex justify-between text-blue-600 font-medium">
            <span>Vuelto</span>
            <span>{formatGs(venta.vuelto)}</span>
          </div>
        )}
      </div>

    </div>
  )
}

export default DetalleVenta