import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const busquedaRef                   = useRef()
  const clienteRef                    = useRef()

  // Edición de cantidad (raw string para permitir "0." "0.5" etc.)
  const [cantidades, setCantidades] = useState({})
  const cartInputRefs = useRef({})

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

  // Pago mixto
  const [pagoDetalle, setPagoDetalle] = useState([])
  const [nuevoPagoTipo, setNuevoPagoTipo] = useState('efectivo')
  const [nuevoPagoMonto, setNuevoPagoMonto] = useState('')

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
    if (!busqueda.trim()) { setResultados([]); setSelectedIndex(-1); return }
    const lower = busqueda.toLowerCase()
    setResultados(
      productos.filter(p =>
        p.nombre.toLowerCase().includes(lower) ||
        p.codigo_barras?.includes(busqueda)
      ).slice(0, 6)
    )
    setSelectedIndex(-1)
  }, [busqueda, productos])

  const handleProductoKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (carrito.length > 0) {
        const firstKey = carrito[0]._key
        cartInputRefs.current[firstKey]?.focus()
        cartInputRefs.current[firstKey]?.select()
      } else {
        clienteRef.current?.focus()
      }
      return
    }
    if (resultados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => prev < resultados.length - 1 ? prev + 1 : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => prev > 0 ? prev - 1 : resultados.length - 1)
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      const p = resultados[selectedIndex]
      const presCount = p.presentaciones?.length || 0
      if (presCount > 1) {
        mostrarSelectorPres(p)
      } else {
        const presDefecto = p.presentaciones?.find(pr => pr.es_venta_defecto === 1)
        agregarAlCarrito(p, presDefecto)
      }
    }
  }

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
        const nuevaCant = Math.round((existe.cantidad + incremento) * 100) / 100
        setCantidades(prevRaw => ({ ...prevRaw, [key]: String(nuevaCant) }))
        return prev.map(i =>
          i._key === key
            ? { ...i, cantidad: nuevaCant }
            : i
        )
      }
      if (producto.stock === 0) {
        setError(`"${producto.nombre}" no tiene stock disponible`)
        return prev
      }
      setCantidades(prevRaw => ({ ...prevRaw, [key]: '1' }))
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

  // ── Cantidad: escritura libre ────────────────────────────────────────
  const esUnidadPeso = (unidad) => unidad === 'kg' || unidad === 'gramo' || unidad === 'litro'

  const handleCantidadChange = (key, raw) => {
    setCantidades(prev => ({ ...prev, [key]: raw }))
  }

  const handleCantidadBlur = (key) => {
    const item = carrito.find(i => i._key === key)
    if (!item) return
    const raw = cantidades[key]
    if (raw === undefined || raw === '') {
      setCantidades(prev => ({ ...prev, [key]: String(item.cantidad) }))
      return
    }
    const num = esUnidadPeso(item.unidad) ? parseFloat(raw) : parseInt(raw, 10)
    if (isNaN(num) || num <= 0) {
      setError(`"${item.nombre}": la cantidad debe ser mayor a 0`)
      setCantidades(prev => ({ ...prev, [key]: String(item.cantidad) }))
      return
    }
    if (num > 999) {
      setError('Cantidad máxima: 999')
      setCantidades(prev => ({ ...prev, [key]: String(item.cantidad) }))
      return
    }
    if (num > item.stock) {
      setError(`"${item.nombre}": stock máximo disponible: ${item.stock}`)
      setCantidades(prev => ({ ...prev, [key]: String(item.cantidad) }))
      return
    }
    const redondeado = esUnidadPeso(item.unidad) ? Math.round(num * 100) / 100 : num
    setError('')
    setCantidades(prev => ({ ...prev, [key]: String(redondeado) }))
    setCarrito(prev =>
      prev.map(i => i._key === key ? { ...i, cantidad: redondeado } : i)
    )
  }

  const handleCantidadKeyDown = (e, key, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (idx < carrito.length - 1) {
        const nextKey = carrito[idx + 1]._key
        cartInputRefs.current[nextKey]?.focus()
        cartInputRefs.current[nextKey]?.select()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx > 0) {
        const prevKey = carrito[idx - 1]._key
        cartInputRefs.current[prevKey]?.focus()
        cartInputRefs.current[prevKey]?.select()
      } else {
        busquedaRef.current?.focus()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleCantidadBlur(key)
      if (idx < carrito.length - 1) {
        const nextKey = carrito[idx + 1]._key
        cartInputRefs.current[nextKey]?.focus()
        cartInputRefs.current[nextKey]?.select()
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      handleCantidadBlur(key)
      if (idx < carrito.length - 1) {
        const nextKey = carrito[idx + 1]._key
        cartInputRefs.current[nextKey]?.focus()
        cartInputRefs.current[nextKey]?.select()
      } else {
        clienteRef.current?.focus()
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      handleCantidadBlur(key)
      if (idx > 0) {
        const prevKey = carrito[idx - 1]._key
        cartInputRefs.current[prevKey]?.focus()
        cartInputRefs.current[prevKey]?.select()
      } else {
        busquedaRef.current?.focus()
      }
    }
  }

  const quitarDelCarrito = (producto_id) => {
    setCarrito(prev => prev.filter(i => i.producto_id !== producto_id))
    setCantidades(prev => {
      const next = { ...prev }
      const item = carrito.find(i => i.producto_id === producto_id)
      if (item) delete next[item._key]
      return next
    })
  }

  // ── Cálculos ─────────────────────────────────────────────────────────
  const subtotalBruto = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
  const totalFinal    = Math.round(Math.max(0, subtotalBruto - Number(descuento)))
  const vuelto        = tipoPago === 'efectivo' && montoPagado
    ? Math.max(0, Math.round(Number(montoPagado) - totalFinal))
    : 0

  // Pago mixto helpers
  const totalMixtoPagado = pagoDetalle.reduce((a, p) => a + p.monto, 0)
  const faltanteMixto    = totalFinal - totalMixtoPagado

  const agregarPagoMixto = () => {
    const monto = Number(nuevoPagoMonto)
    if (!monto || monto <= 0) return
    if (totalMixtoPagado + monto > totalFinal) {
      setError('El monto excede el total de la venta')
      return
    }
    setPagoDetalle(prev => [...prev, { tipo: nuevoPagoTipo, monto }])
    setNuevoPagoMonto('')
    setError('')
  }

  const quitarPagoMixto = (index) =>
    setPagoDetalle(prev => prev.filter((_, i) => i !== index))

  // Resetear pagoDetalle al cambiar tipo de pago
  useEffect(() => {
    if (tipoPago !== 'mixto') {
      setPagoDetalle([])
      setNuevoPagoMonto('')
    }
  }, [tipoPago])

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
    if (tipoPago === 'mixto' && totalMixtoPagado < totalFinal)
      return setError(`Faltan ${formatGs(totalFinal - totalMixtoPagado)} para completar el total`)

    for (const item of carrito) {
      if (item.cantidad <= 0) {
        return setError(`"${item.nombre}" tiene cantidad ${item.cantidad}. La cantidad debe ser mayor a 0`)
      }
    }

    setCargando(true)
    try {
      const payload = {
        usuario_id:      usuario.id,
        cliente_id:      clienteSeleccionado?.id || null,
        condicion_venta: condicion,
        tipo_pago:       tipoPago,
        descuento:       Number(descuento) || 0,
        monto_pagado:    tipoPago === 'mixto' ? totalMixtoPagado : Number(montoPagado) || totalFinal,
        items:           carrito.map(i => ({
          producto_id:     i.producto_id,
          presentation_id: i.presentation_id,
          cantidad:        i.cantidad,
          precio_unitario: i.precio_unitario
        }))
      }
      if (tipoPago === 'mixto') {
        payload.pago_detalle = pagoDetalle
      }
      const { data } = await api.post('/ventas', payload)
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
            onKeyDown={handleProductoKeyDown}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            autoFocus
          />
          {resultados.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
              {resultados.map((p, idx) => {
                const presCount = p.presentaciones?.length || 0
                const presDefecto = p.presentaciones?.find(pr => pr.es_venta_defecto === 1)
                const isSelected = idx === selectedIndex
                return (
                  <div key={p.id} className={`border-b last:border-0 ${isSelected ? 'bg-emerald-50' : ''}`}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs font-bold ${p.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            Stock: {p.stock} {p.unidad || 'un.'}
                          </span>
                          {presDefecto && (
                            <span className="text-sm font-bold text-emerald-700">
                              {formatGs(presDefecto.precio_venta)}
                            </span>
                          )}
                          {p.codigo_barras && (
                            <span className="text-xs text-gray-400">{p.codigo_barras}</span>
                          )}
                        </div>
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
                  {carrito.map((item, idx) => (
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
        ref={el => { cartInputRefs.current[item._key] = el }}
        type="text"
        inputMode={esUnidadPeso(item.unidad) ? 'decimal' : 'numeric'}
        value={cantidades[item._key] ?? String(item.cantidad)}
        onChange={e => handleCantidadChange(item._key, e.target.value)}
        onBlur={() => handleCantidadBlur(item._key)}
        onKeyDown={e => handleCantidadKeyDown(e, item._key, idx)}
        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                {clienteSeleccionado.deuda_total > 0 && (
                  <p className="text-xs text-amber-600 font-medium">Deuda: {formatGs(clienteSeleccionado.deuda_total)}</p>
                )}
              </div>
              <button onClick={limpiarCliente} className="text-emerald-400 hover:text-emerald-600 text-lg">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                ref={clienteRef}
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
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                        {c.ruc_ci && <p className="text-xs text-gray-400">{c.ruc_ci}</p>}
                      </div>
                      {c.deuda_total > 0 && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Deuda: {formatGs(c.deuda_total)}
                        </span>
                      )}
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

          {tipoPago === 'mixto' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Medios de pago:</p>

              {pagoDetalle.length > 0 && (
                <div className="space-y-1.5">
                  {pagoDetalle.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="capitalize text-gray-700">{p.tipo}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatGs(p.monto)}</span>
                        <button onClick={() => quitarPagoMixto(i)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <select value={nuevoPagoTipo} onChange={e => setNuevoPagoTipo(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="qr">QR</option>
                  <option value="debito">Débito</option>
                </select>
                <input type="number" value={nuevoPagoMonto}
                  onChange={e => setNuevoPagoMonto(e.target.value)}
                  placeholder={String(Math.max(0, faltanteMixto))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  min="0" />
                <button onClick={agregarPagoMixto}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                  +
                </button>
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>Pagado: <span className="font-medium text-emerald-600">{formatGs(totalMixtoPagado)}</span></span>
                <span>Falta: <span className={`font-medium ${faltanteMixto > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatGs(Math.max(0, faltanteMixto))}</span></span>
              </div>
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
          {tipoPago === 'mixto' && totalMixtoPagado >= totalFinal && (
            <div className="flex justify-between text-blue-600 font-medium">
              <span>Vuelto</span>
              <span>{formatGs(totalMixtoPagado - totalFinal)}</span>
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