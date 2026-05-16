import { useState, useEffect } from 'react'
import api from '../../api/axios'

const Productos = () => {
  const [productos, setProductos]     = useState([])
  const [categorias, setCategorias]   = useState([])
  const [cargando, setCargando]       = useState(true)
  const [busqueda, setBusqueda]       = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modal, setModal]             = useState(false)
  const [editando, setEditando]       = useState(null)
  const [error, setError]             = useState('')
  const [form, setForm]               = useState({
    nombre: '', codigo_barras: '', precio_compra: '',
    precio_venta: '', stock: '', stock_minimo: '5',
    categoria_id: '', tasa_iva: '10'
  })

  const cargarDatos = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/productos'),
        api.get('/categorias')
      ])
      setProductos(prodRes.data)
      setCategorias(catRes.data)
    } catch (err) {
      setError('Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const abrirModal = (producto = null) => {
    if (producto) {
      setEditando(producto)
      setForm({
        nombre:        producto.nombre,
        codigo_barras: producto.codigo_barras || '',
        precio_compra: producto.precio_compra,
        precio_venta:  producto.precio_venta,
        stock:         producto.stock,
        stock_minimo:  producto.stock_minimo,
        categoria_id:  producto.categoria_id || '',
        tasa_iva:      producto.tasa_iva
      })
    } else {
      setEditando(null)
      setForm({
        nombre: '', codigo_barras: '', precio_compra: '',
        precio_venta: '', stock: '', stock_minimo: '5',
        categoria_id: '', tasa_iva: '10'
      })
    }
    setError('')
    setModal(true)
  }

  const cerrarModal = () => {
    setModal(false)
    setEditando(null)
    setError('')
  }

 const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
        const payload = {
        nombre:        form.nombre,
        codigo_barras: form.codigo_barras || null,
        precio_compra: Number(form.precio_compra) || 0,
        precio_venta:  Number(form.precio_venta),
        stock:         Number(form.stock) || 0,
        stock_minimo:  Number(form.stock_minimo) || 0,
        categoria_id:  form.categoria_id ? Number(form.categoria_id) : null,
        tasa_iva:      Number(form.tasa_iva)
        }
        if (editando) {
        await api.put(`/productos/${editando.id}`, payload)
        } else {
        await api.post('/productos', payload)
        }
        await cargarDatos()
        cerrarModal()
    } catch (err) {
        setError(err.response?.data?.error || 'Error al guardar')
    }
 }

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar este producto?')) return
    try {
      await api.delete(`/productos/${id}`)
      await cargarDatos()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al desactivar')
    }
  }

  const activar = async (id) => {
  if (!confirm('¿Activar este producto?')) return
  try {
    await api.patch(`/productos/${id}/activar`)
    await cargarDatos()
  } catch (err) {
    alert(err.response?.data?.error || 'Error al activar')
  }
}

  const productosFiltrados = productos.filter(p => {
    const coincideBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo_barras?.includes(busqueda)
    const coincideCategoria = filtroCategoria
      ? p.categoria_id === Number(filtroCategoria)
      : true
    return coincideBusqueda && coincideCategoria
  })

  const formatGs = n => `Gs. ${Number(n).toLocaleString('es-PY')}`

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando productos...</p>
    </div>
  )

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{productos.length} productos registrados</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o código..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">P. Compra</th>
              <th className="px-4 py-3 text-right">P. Venta</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-center">IVA</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron productos
                </td>
              </tr>
            ) : productosFiltrados.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{p.nombre}</p>
                  {p.codigo_barras && (
                    <p className="text-xs text-gray-400">{p.codigo_barras}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {p.categoria_nombre || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{formatGs(p.precio_compra)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{formatGs(p.precio_venta)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`
                    inline-block px-2 py-0.5 rounded-full text-xs font-medium
                    ${p.stock <= p.stock_minimo
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'}
                  `}>
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{p.tasa_iva}%</td>
                <td className="px-4 py-3 text-center">
                  <span className={`
                    inline-block px-2 py-0.5 rounded-full text-xs font-medium
                    ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}
                  `}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                <div className="flex justify-center gap-2">
                    <button
                    onClick={() => abrirModal(p)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                    Editar
                    </button>
                    {p.activo === 1 ? (
                    <button
                        onClick={() => desactivar(p.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                        Desactivar
                    </button>
                    ) : (
                    <button
                        onClick={() => activar(p.id)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                        Activar
                    </button>
                    )}
                </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
                  <input
                    type="text"
                    value={form.codigo_barras}
                    onChange={e => setForm({ ...form, codigo_barras: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio compra *</label>
                  <input
                    type="number"
                    value={form.precio_compra}
                    onChange={e => setForm({ ...form, precio_compra: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta *</label>
                  <input
                    type="number"
                    value={form.precio_venta}
                    onChange={e => setForm({ ...form, precio_venta: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock inicial</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    value={form.stock_minimo}
                    onChange={e => setForm({ ...form, stock_minimo: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={form.categoria_id}
                    onChange={e => setForm({ ...form, categoria_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa IVA</label>
                  <select
                    value={form.tasa_iva}
                    onChange={e => setForm({ ...form, tasa_iva: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="10">10%</option>
                    <option value="5">5%</option>
                    <option value="0">Exento</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {editando ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Productos