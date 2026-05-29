import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatGs = n => `Gs. ${Number(n).toLocaleString('es-PY')}`

const NuevaVenta = () => {
  const { usuario } = useAuth()
  const navigate    = useNavigate()

  const [productos, setProductos]     = useState([])
  const [clientes, setClientes]       = useState([])
  const [carrito, setCarrito]         = useState([])
  const [cajaAbierta, setCajaAbierta] = useState(null)

  // Búsqueda producto
  const [busqueda, setBusqueda]       = useState('')
  const [resultados, setResultados]   = useState([])
  const busquedaRef                   = useRef()

  // Selector de presentación
  const [showPresSelector, setShowPresSelector] = useState(false)
  const [productoParaPres, setProductoParaPres] = useState(null)

  // Búsqueda cliente
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false)
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', ruc_ci: '', telefono: '' })
  const [errorCliente, setErrorCliente] = useState('')

  // Pago
  const [tipoPago, setTipoPago]       = useState('efectivo')
  const [montoPagado, setMontoPagado] = useState('')
  const [descuento, setDescuento]     = useState(0)
  const [error, setError]             = useState('')
  const [cargando, setCargando]       = useState(false)

  useEffect(() => {
    const cargarDatos = async () => {
      const [prodRes, cliRes, cajaRes] = await Promise.all([
        api.get('/productos'),
        api.get('/clientes'),
        api.get('/caja/activa').catch(() => ({ data: null }))
      ])
      setProductos(prodRes.data.filter(p => p.activo === 1))
      setClientes(cliRes.data)
      setCajaAbierta(cajaRes.data)
    }
    cargarDatos()
  }, [])

  // ── Búsqueda de productos ────────────────────────────────────────────
  useEffect(() => {
    if (!busqueda.trim()) return setResultados([])
    const lower = busqueda.toLowerCase()
    setResultados(
      productos.filter(p =>
        p.nombre.toLowerCase().includes(lower) ||
        p.codigo_barras?.includes(busqueda)
      ).slice(0, 6)
    )
  }, [busqueda, productos])

  // ── Búsqueda de clientes ─────────────────────────────────────────────
  useEffect(() => {
    if (!busquedaCliente.trim()) return setResultadosCliente([])
    const lower = busquedaCliente.toLowerCase()
    setResultadosCliente(
      clientes.filter(c =>
        c.nombre.toLowerCase().includes(lower) ||
        c.ruc_ci?.includes(busquedaCliente)
      ).slice(0, 5)
    )
  }, [busquedaCliente, clientes])

  const seleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente)
    setBusquedaCliente(cliente.nombre)
    setResultadosCliente([])
    setMostrarDropdownCliente(false)
  }

  const limpiarCliente = () => {
    setClienteSeleccionado(null)
    setBusquedaCliente('')
  }

  const crearCliente = async () => {
    setErrorCliente('')
    if (!nuevoCliente.nombre.trim()) return setErrorCliente('El nombre es obligatorio')
    try {
      const { data } = await api.post('/clientes', {
        nombre:   nuevoCliente.nombre.trim(),
        ruc_ci:   nuevoCliente.ruc_ci   || null,
        telefono: nuevoCliente.telefono || null
      })
      const clienteCreado = { ...data, nombre: nuevoCliente.nombre.trim() }
      setClientes(prev => [...prev, clienteCreado])
      seleccionarCliente(clienteCreado)
      setMostrarModalCliente(false)
      setNuevoCliente({ nombre: '', ruc_ci: '', telefono: '' })
    } catch (err) {
      setErrorCliente(err.response?.data?.error || 'Error al crear cliente')
    }
  }

  // ── Carrito ──────────────────────────────────────────────────────────
  const agregarAlCarrito = (producto, presentacion = null) => {
    const pres = presentacion || producto.presentaciones?.find(p => p.es_venta_defecto === 1)

    setCarrito(prev => {
      const key = pres ? `pres_${pres.id}` : `prod_${producto.id}`
      const existe = prev.find(i => i._key === key)
      if (existe) {
        if (existe.cantidad >= 999) {
          setError('Cantidad máxima: 999')
          return prev
        }
        const incremento = producto.unidad === 'kg' || producto.unidad === 'gramo' || producto.unidad === 'litro' ? 0.1 : 1
        return prev.map(i =>
          i._key === key
            ? { ...i, cantidad: Math.round((i.cantidad + incremento) * 100) / 100 }
            : i
        )
      }
      if (producto.stock === 0) {
        setError(`"${producto.nombre}" no tiene stock disponible`)
        return prev
      }
      return [...prev, {
        _key:              key,
        producto_id:       producto.id,
        presentation_id:   pres?.id || null,
        nombre:            producto.nombre,
        presentacion_nombre: pres?.nombre || null,
        precio_unitario:   pres?.precio_venta || producto.precio_venta,
        tasa_iva:          producto.tasa_iva,
        stock:             producto.stock,
        unidad:            producto.unidad || 'unidad',
        cantidad:          1
      }]
    })
    setBusqueda('')
    setResultados([])
    setError('')
    setShowPresSelector(false)
    setProductoParaPres(null)
    busquedaRef.current?.focus()
  }

  const mostrarSelectorPres = (producto) => {
    setProductoParaPres(producto)
    setShowPresSelector(true)
  }

  const cambiarCantidad = (producto_id, valor) => {
    const item = carrito.find(i => i.producto_id === producto_id)
    const esPeso = item.unidad === 'kg' || item.unidad === 'gramo' || item.unidad === 'litro'
    const num = esPeso ? parseFloat(valor) : parseInt(valor)
    if (isNaN(num) || num <= 0) return
    if (num > item.stock) return setError(`Stock máximo disponible: ${item.stock}`)
    setError('')
    setCarrito(prev =>
      prev.map(i => i.producto_id === producto_id ? { ...i, cantidad: num } : i)
    )
  }

  const quitarDelCarrito = (producto_id) =>
    setCarrito(prev => prev.filter(i => i.producto_id !== producto_id))

  const cambiarCantidadPres = (key, valor) => {
    const item = carrito.find(i => i._key === key)
    if (!item) return
    const esPeso = item.unidad === 'kg' || item.unidad === 'gramo' || item.unidad === 'litro'
    const num = esPeso ? parseFloat(valor) : parseInt(valor)
    if (isNaN(num) || num <= 0) return
    if (num > 999) return setError('Cantidad máxima: 999')
    setError('')
    setCarrito(prev =>
      prev.map(i => i._key === key ? { ...i, cantidad: num } : i)
    )
  }

  // ── Cálculos ─────────────────────────────────────────────────────────
  const subtotalBruto = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
  const totalFinal    = Math.round(Math.max(0, subtotalBruto - Number(descuento)))
  const vuelto        = tipoPago === 'efectivo' && montoPagado
    ? Math.max(0, Math.round(Number(montoPagado) - totalFinal))
    : 0

  // condición se deriva del tipo de pago
  const condicion = tipoPago === 'fiado' ? 'credito' : 'contado'

  // ── Confirmar venta ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError('')
    if (carrito.length === 0)   return setError('Agregá al menos un producto')
    if (!tipoPago)              return setError('Seleccioná un tipo de pago')
    if (tipoPago === 'fiado' && !clienteSeleccionado)
      return setError('Venta fiada requiere un cliente')
    if (tipoPago === 'efectivo' && montoPagado && Number(montoPagado) < totalFinal)
      return setError('El monto recibido es menor al total')

    setCargando(true)
    try {
      const { data } = await api.post('/ventas', {
        usuario_id:      usuario.id,
        cliente_id:      clienteSeleccionado?.id || null,
        condicion_venta: condicion,
        tipo_pago:       tipoPago,
        descuento:       Number(descuento) || 0,
        monto_pagado:    Number(montoPagado) || totalFinal,
        items:           carrito.map(i => ({
          producto_id:     i.producto_id,
          presentation_id: i.presentation_id,
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

      {/* ── Columna izquierda ── */}
      <div className="flex-1 flex flex-col gap-4">

        {!cajaAbierta && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
            ⚠️ No hay caja abierta. Dirigite a <Link to="/caja" className="font-medium text-yellow-800 underline">Caja</Link> para abrirla antes de vender.
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Venta</h1>
          <p className="text-sm text-gray-500 mt-0.5">Buscá productos por nombre o código de barras</p>
        </div>

        {/* Buscador productos */}
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
              {resultados.map(p => {
                const presCount = p.presentaciones?.length || 0
                const presDefecto = p.presentaciones?.find(pr => pr.es_venta_defecto === 1)
                return (
                  <div key={p.id} className="border-b last:border-0">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {p.codigo_barras || 'Sin código'} · IVA {p.tasa_iva}% · Stock: {p.stock} {p.unidad || 'unidad'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {presCount > 1 ? (
                          <button
                            onClick={() => mostrarSelectorPres(p)}
                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded font-medium"
                          >
                            {presCount} pres.
                          </button>
                        ) : (
                          <button
                            onClick={() => agregarAlCarrito(p, presDefecto)}
                            className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1 rounded font-medium"
                          >
                            Agregar
                          </button>
                        )}
                        {presDefecto && (
                          <p className="text-sm font-semibold text-emerald-600 w-20 text-right">
                            {formatGs(presDefecto.precio_venta)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
                  <th className="px-4 py-3 text-center w-32">Cantidad</th>
                  <th className="px-4 py-3 text-right w-36">Precio unit.</th>
                  <th className="px-4 py-3 text-right w-36">Subtotal</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {carrito.map(item => (
                  <tr key={item._key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{item.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {item.presentacion_nombre && <span className="text-purple-600 font-medium">{item.presentacion_nombre}</span>}
                        {item.presentacion_nombre && <span> · </span>}
                        IVA {item.tasa_iva}% · {item.unidad} ·
                        <span className={item.stock <= 5 ? 'text-red-400' : 'text-gray-400'}>
                          {' '}Disponible: {item.stock}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
      <input
        type="number"
        value={item.cantidad}
        step={item.unidad === 'kg' || item.unidad === 'gramo' || item.unidad === 'litro' ? '0.1' : '1'}
        onChange={e => cambiarCantidad(item.producto_id, e.target.value)}
        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        max={999}
      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {formatGs(item.precio_unitario)}
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

      {/* ── Columna derecha ── */}
      <div className="w-80 flex flex-col gap-4">

        {/* Búsqueda cliente */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>

          {clienteSeleccionado ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-emerald-800">{clienteSeleccionado.nombre}</p>
                {clienteSeleccionado.ruc_ci && (
                  <p className="text-xs text-emerald-600">{clienteSeleccionado.ruc_ci}</p>
                )}
              </div>
              <button onClick={limpiarCliente} className="text-emerald-400 hover:text-emerald-600 text-lg">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre o CI..."
                value={busquedaCliente}
                onChange={e => {
                  setBusquedaCliente(e.target.value)
                  setMostrarDropdownCliente(true)
                }}
                onFocus={() => setMostrarDropdownCliente(true)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {mostrarDropdownCliente && busquedaCliente.trim() && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                  {resultadosCliente.map(c => (
                    <button
                      key={c.id}
                      onClick={() => seleccionarCliente(c)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-emerald-50 text-left border-b last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                      {c.ruc_ci && <p className="text-xs text-gray-400">{c.ruc_ci}</p>}
                    </button>
                  ))}
                  {/* Opción crear si no hay resultados */}
                  <button
                    onClick={() => {
                      setNuevoCliente({ nombre: busquedaCliente, ruc_ci: '', telefono: '' })
                      setMostrarModalCliente(true)
                      setMostrarDropdownCliente(false)
                    }}
                    className="w-full px-3 py-2.5 text-left text-sm text-emerald-600 hover:bg-emerald-50 font-medium border-t"
                  >
                    + Crear "{busquedaCliente}"
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tipo de pago */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Tipo de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { valor: 'efectivo',      icono: '💵', label: 'Efectivo'  },
              { valor: 'transferencia', icono: '🏦', label: 'Transfer.' },
              { valor: 'qr',            icono: '📱', label: 'QR'        },
              { valor: 'debito',        icono: '💳', label: 'Débito'    },
              { valor: 'mixto',         icono: '🔀', label: 'Mixto'     },
              { valor: 'fiado',         icono: '📋', label: 'Fiado'     },
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

          {/* Condición derivada — solo informativa */}
          <p className="text-xs text-gray-400">
            Condición: <span className="font-medium text-gray-600 capitalize">{condicion}</span>
          </p>

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

        {/* Total */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2 text-sm">
          {descuento > 0 && (
            <div className="flex justify-between text-orange-500">
              <span>Descuento</span>
              <span>- {formatGs(descuento)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base text-gray-800">
            <span>TOTAL</span>
            <span className="text-emerald-600">{formatGs(totalFinal)}</span>
          </div>
          {tipoPago === 'efectivo' && montoPagado && (
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

        <button
          onClick={handleSubmit}
          disabled={cargando || carrito.length === 0 || !cajaAbierta}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors text-base shadow-sm"
        >
          {cargando ? 'Registrando...' : !cajaAbierta ? 'Abrí la caja primero' : `Confirmar · ${formatGs(totalFinal)}`}
        </button>

      </div>

      {/* ── Modal crear cliente rápido ── */}
      {mostrarModalCliente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo cliente</h2>
              <button
                onClick={() => setMostrarModalCliente(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { campo: 'nombre',   label: 'Nombre *',  placeholder: 'Ej: Juan Pérez'   },
                { campo: 'ruc_ci',   label: 'RUC / CI',  placeholder: 'Ej: 1234567-8'    },
                { campo: 'telefono', label: 'Teléfono',  placeholder: 'Ej: 0981000000'   },
              ].map(({ campo, label, placeholder }) => (
                <div key={campo}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={nuevoCliente[campo]}
                    onChange={e => setNuevoCliente(prev => ({ ...prev, [campo]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
              {errorCliente && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorCliente}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setMostrarModalCliente(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearCliente}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Crear y seleccionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal selector de presentación */}
      {showPresSelector && productoParaPres && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {productoParaPres.nombre}
              </h2>
              <button
                onClick={() => { setShowPresSelector(false); setProductoParaPres(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >✕</button>
            </div>
            <div className="px-6 py-4 space-y-2">
              <p className="text-sm text-gray-500 mb-2">Seleccioná una presentación:</p>
              {productoParaPres.presentaciones?.map(pres => (
                <button
                  key={pres.id}
                  onClick={() => agregarAlCarrito(productoParaPres, pres)}
                  className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-800">{pres.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {pres.unidades_por_paquete} {productoParaPres.unidad || 'unidad'}{pres.unidades_por_paquete !== 1 ? 'es' : ''} · Stock: {productoParaPres.stock}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">{formatGs(pres.precio_venta)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default NuevaVenta