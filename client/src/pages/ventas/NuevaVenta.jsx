import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatGs = n => `Gs. ${Number(n).toLocaleString('es-PY')}`

const NuevaVenta = () => {
  const { usuario } = useAuth()
  const navigate    = useNavigate()

  const [productos, setProductos]   = useState([])
  const [clientes, setClientes]     = useState([])
  const [carrito, setCarrito]       = useState([])
  const [busqueda, setBusqueda]     = useState('')
  const [resultados, setResultados] = useState([])
  const [clienteId, setClienteId]   = useState('')
  const [tipoPago, setTipoPago]     = useState('efectivo')
  const [condicion, setCondicion]   = useState('contado')
  const [montoPagado, setMontoPagado] = useState('')
  const [descuento, setDescuento]   = useState(0)
  const [error, setError]           = useState('')
  const [cargando, setCargando]     = useState(false)
  const busquedaRef                 = useRef()

  useEffect(() => {
    const cargarDatos = async () => {
      const [prodRes, cliRes] = await Promise.all([
        api.get('/productos'),
        api.get('/clientes')
      ])
      setProductos(prodRes.data.filter(p => p.activo === 1))
      setClientes(cliRes.data)
    }
    cargarDatos()
  }, [])

  // Búsqueda de productos en tiempo real
  useEffect(() => {
    if (!busqueda.trim()) return setResultados([])
    const lower = busqueda.toLowerCase()
    const encontrados = productos.filter(p =>
      p.nombre.toLowerCase().includes(lower) ||
      p.codigo_barras?.includes(busqueda)
    ).slice(0, 6)
    setResultados(encontrados)
  }, [busqueda, productos])

  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          setError(`Stock máximo disponible: ${producto.stock}`)
          return prev
        }
        return prev.map(i =>
          i.producto_id === producto.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        )
      }
      if (producto.stock === 0) {
        setError(`"${producto.nombre}" no tiene stock disponible`)
        return prev
      }
      return [...prev, {
        producto_id:     producto.id,
        nombre:          producto.nombre,
        precio_unitario: producto.precio_venta,
        tasa_iva:        producto.tasa_iva,
        stock:           producto.stock,
        cantidad:        1
      }]
    })
    setBusqueda('')
    setResultados([])
    setError('')
    busquedaRef.current?.focus()
  }

  const cambiarCantidad = (producto_id, valor) => {
    const num = parseInt(valor)
    if (isNaN(num) || num < 1) return
    const item = carrito.find(i => i.producto_id === producto_id)
    if (num > item.stock) {
      setError(`Stock máximo disponible: ${item.stock}`)
      return
    }
    setError('')
    setCarrito(prev =>
      prev.map(i => i.producto_id === producto_id ? { ...i, cantidad: num } : i)
    )
  }

  const cambiarPrecio = (producto_id, valor) => {
    const num = parseFloat(valor)
    if (isNaN(num) || num < 0) return
    setCarrito(prev =>
      prev.map(i => i.producto_id === producto_id ? { ...i, precio_unitario: num } : i)
    )
  }

  const quitarDelCarrito = (producto_id) => {
    setCarrito(prev => prev.filter(i => i.producto_id !== producto_id))
  }

  // Cálculos
  const subtotalBruto = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
  const totalFinal    = Math.max(0, subtotalBruto - descuento)
  const vuelto        = tipoPago === 'efectivo' && montoPagado
    ? Math.max(0, Number(montoPagado) - totalFinal)
    : 0

  const calcularIVACarrito = () => {
    let iva10 = 0, iva5 = 0, exento = 0, gravado10 = 0, gravado5 = 0
    carrito.forEach(i => {
      const sub = i.precio_unitario * i.cantidad
      if (i.tasa_iva === 10) {
        const iva = Math.round(sub / 11)
        iva10    += iva
        gravado10 += sub - iva
      } else if (i.tasa_iva === 5) {
        const iva = Math.round(sub / 21)
        iva5    += iva
        gravado5 += sub - iva
      } else {
        exento += sub
      }
    })
    return { iva10, iva5, exento, gravado10, gravado5 }
  }

  const { iva10, iva5, exento, gravado10, gravado5 } = calcularIVACarrito()

  const handleSubmit = async () => {
    setError('')
    if (carrito.length === 0) return setError('Agregá al menos un producto')
    if (!tipoPago)            return setError('Seleccioná un tipo de pago')
    if (tipoPago === 'fiado' && !clienteId) return setError('Venta fiada requiere un cliente')
    if (tipoPago === 'efectivo' && montoPagado && Number(montoPagado) < totalFinal)
      return setError('El monto pagado es menor al total')

    setCargando(true)
    try {
      const { data } = await api.post('/ventas', {
        usuario_id:      usuario.id,
        cliente_id:      clienteId || null,
        condicion_venta: condicion,
        tipo_pago:       tipoPago,
        descuento:       Number(descuento) || 0,
        monto_pagado:    Number(montoPagado) || totalFinal,
        items:           carrito.map(i => ({
          producto_id:     i.producto_id,
          cantidad:        i.cantidad,
          precio_unitario: i.precio_unitario
        }))
      })
      navigate(`/ventas/${data.venta_id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la venta')
      setCargando(false)
    }
  }

  return (
    <div className="flex gap-6 h-full">

      {/* ── Columna izquierda: buscador + carrito ── */}
      <div className="flex-1 flex flex-col gap-4">

        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Venta</h1>
          <p className="text-sm text-gray-500 mt-0.5">Buscá productos por nombre o código de barras</p>
        </div>

        {/* Buscador */}
        <div className="relative">
          <input
            ref={busquedaRef}
            type="text"
            placeholder="🔍  Nombre o código de barras..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            autoFocus
          />
          {resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
              {resultados.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarAlCarrito(p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 transition-colors text-left border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-400">{p.codigo_barras || 'Sin código'} · IVA {p.tasa_iva}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">{formatGs(p.precio_venta)}</p>
                    <p className={`text-xs ${p.stock <= p.stock_minimo ? 'text-red-500' : 'text-gray-400'}`}>
                      Stock: {p.stock}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300">
              <p className="text-5xl mb-3">🛒</p>
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-center w-24">Cantidad</th>
                  <th className="px-4 py-3 text-right w-36">Precio unit.</th>
                  <th className="px-4 py-3 text-right w-36">Subtotal</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carrito.map(item => (
                  <tr key={item.producto_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{item.nombre}</p>
                      <p className="text-xs text-gray-400">IVA {item.tasa_iva}%</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={e => cambiarCantidad(item.producto_id, e.target.value)}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="1"
                        max={item.stock}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={item.precio_unitario}
                        onChange={e => cambiarPrecio(item.producto_id, e.target.value)}
                        className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {formatGs(item.precio_unitario * item.cantidad)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => quitarDelCarrito(item.producto_id)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ── Columna derecha: resumen y cobro ── */}
      <div className="w-80 flex flex-col gap-4">

        {/* Cliente */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Consumidor final</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Pago */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Tipo de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { valor: 'efectivo',      icono: '💵', label: 'Efectivo'    },
              { valor: 'transferencia', icono: '🏦', label: 'Transfer.'   },
              { valor: 'qr',            icono: '📱', label: 'QR'          },
              { valor: 'debito',        icono: '💳', label: 'Débito'      },
              { valor: 'mixto',         icono: '🔀', label: 'Mixto'       },
              { valor: 'fiado',         icono: '📋', label: 'Fiado'       },
            ].map(op => (
              <button
                key={op.valor}
                onClick={() => setTipoPago(op.valor)}
                className={`
                  flex flex-col items-center py-2 rounded-lg border text-xs font-medium transition-colors
                  ${tipoPago === op.valor
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}
                `}
              >
                <span className="text-lg mb-0.5">{op.icono}</span>
                {op.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Condición</label>
            <select
              value={condicion}
              onChange={e => setCondicion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
          </div>

          {tipoPago === 'efectivo' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto recibido</label>
              <input
                type="number"
                value={montoPagado}
                onChange={e => setMontoPagado(e.target.value)}
                placeholder={String(totalFinal)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                min="0"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descuento (Gs.)</label>
            <input
              type="number"
              value={descuento}
              onChange={e => setDescuento(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min="0"
            />
          </div>
        </div>

        {/* Totales IVA */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Gravado 10%</span>
            <span>{formatGs(gravado10)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>IVA 10%</span>
            <span>{formatGs(iva10)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Gravado 5%</span>
            <span>{formatGs(gravado5)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>IVA 5%</span>
            <span>{formatGs(iva5)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Exento</span>
            <span>{formatGs(exento)}</span>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between text-orange-500">
              <span>Descuento</span>
              <span>- {formatGs(descuento)}</span>
            </div>
          )}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold text-gray-800 text-base">
            <span>TOTAL</span>
            <span className="text-emerald-600">{formatGs(totalFinal)}</span>
          </div>
          {tipoPago === 'efectivo' && montoPagado && vuelto >= 0 && (
            <div className="flex justify-between text-blue-600 font-medium">
              <span>Vuelto</span>
              <span>{formatGs(vuelto)}</span>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Botón confirmar */}
        <button
          onClick={handleSubmit}
          disabled={cargando || carrito.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-base shadow-sm"
        >
          {cargando ? 'Registrando...' : `Confirmar venta · ${formatGs(totalFinal)}`}
        </button>

      </div>
    </div>
  )
}

export default NuevaVenta