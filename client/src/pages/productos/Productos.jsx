import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatGs = n => `Gs. ${Number(n).toLocaleString('es-PY')}`

const Productos = () => {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
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
    categoria_id: '', tasa_iva: '10', unidad: 'unidad'
  })

  // Estado para el modal de presentaciones
  const [modalPres, setModalPres]       = useState(false)
  const [productoPres, setProductoPres] = useState(null)
  const [presentaciones, setPresentaciones] = useState([])
  const [editandoPres, setEditandoPres] = useState(null)
  const [formPres, setFormPres]         = useState({
    nombre: '', unidades_por_paquete: '1',
    precio_venta: '', precio_compra: '',
    codigo_barras: '', es_venta_defecto: false, es_compra_defecto: false
  })
  const [errorPres, setErrorPres]       = useState('')

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
        tasa_iva:      producto.tasa_iva,
        unidad:        producto.unidad || 'unidad'
      })
    } else {
      setEditando(null)
      setForm({
        nombre: '', codigo_barras: '', precio_compra: '',
        precio_venta: '', stock: '', stock_minimo: '5',
        categoria_id: '', tasa_iva: '10', unidad: 'unidad'
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
        tasa_iva:      Number(form.tasa_iva),
        unidad:        form.unidad || 'unidad'
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

  // ── Presentaciones ────────────────────────────────────────────────────
  const abrirModalPres = async (producto) => {
    setProductoPres(producto)
    setEditandoPres(null)
    setFormPres({
      nombre: '', unidades_por_paquete: '1',
      precio_venta: '', precio_compra: '',
      codigo_barras: '', es_venta_defecto: false, es_compra_defecto: false
    })
    setErrorPres('')
    try {
      const { data } = await api.get(`/productos/${producto.id}/presentaciones`)
      setPresentaciones(data)
    } catch {
      setPresentaciones([])
    }
    setModalPres(true)
  }

  const cerrarModalPres = () => {
    setModalPres(false)
    setProductoPres(null)
    setPresentaciones([])
    setEditandoPres(null)
    setErrorPres('')
  }

  const editarPres = (pres) => {
    setEditandoPres(pres)
    setFormPres({
      nombre: pres.nombre,
      unidades_por_paquete: String(pres.unidades_por_paquete),
      precio_venta: String(pres.precio_venta),
      precio_compra: String(pres.precio_compra),
      codigo_barras: pres.codigo_barras || '',
      es_venta_defecto: Boolean(pres.es_venta_defecto),
      es_compra_defecto: Boolean(pres.es_compra_defecto)
    })
    setErrorPres('')
  }

  const handleSubmitPres = async (e) => {
    e.preventDefault()
    setErrorPres('')
    const payload = {
      nombre: formPres.nombre.trim(),
      unidades_por_paquete: Number(formPres.unidades_por_paquete),
      precio_venta: Number(formPres.precio_venta) || 0,
      precio_compra: Number(formPres.precio_compra) || 0,
      codigo_barras: formPres.codigo_barras || null,
      es_venta_defecto: formPres.es_venta_defecto,
      es_compra_defecto: formPres.es_compra_defecto
    }
    if (!payload.nombre) return setErrorPres('El nombre es obligatorio')
    if (!payload.unidades_por_paquete || payload.unidades_por_paquete <= 0)
      return setErrorPres('Las unidades por paquete deben ser > 0')

    try {
      if (editandoPres) {
        await api.put(`/productos/${productoPres.id}/presentaciones/${editandoPres.id}`, payload)
      } else {
        await api.post(`/productos/${productoPres.id}/presentaciones`, payload)
      }
      const { data } = await api.get(`/productos/${productoPres.id}/presentaciones`)
      setPresentaciones(data)
      setEditandoPres(null)
      setFormPres({
        nombre: '', unidades_por_paquete: '1',
        precio_venta: '', precio_compra: '',
        codigo_barras: '', es_venta_defecto: false, es_compra_defecto: false
      })
      await cargarDatos()
    } catch (err) {
      setErrorPres(err.response?.data?.error || 'Error al guardar presentación')
    }
  }

  const eliminarPres = async (presId) => {
    if (!confirm('¿Eliminar esta presentación?')) return
    try {
      await api.delete(`/productos/${productoPres.id}/presentaciones/${presId}`)
      setPresentaciones(prev => prev.filter(p => p.id !== presId))
      await cargarDatos()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
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
        {esAdmin && (
          <button
            onClick={() => abrirModal()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nuevo producto
          </button>
        )}
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
                {esAdmin ? (
                  <div className="flex justify-center gap-2">
                    <button onClick={() => abrirModalPres(p)} className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                      Presentaciones
                    </button>
                    <button onClick={() => abrirModal(p)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Editar
                    </button>
                    {p.activo === 1 ? (
                      <button onClick={() => desactivar(p.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Desactivar
                      </button>
                    ) : (
                      <button onClick={() => activar(p.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                        Activar
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de venta</label>
                  <select
                    value={form.unidad}
                    onChange={e => setForm({ ...form, unidad: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="unidad">Unidad (u)</option>
                    <option value="kg">Kilogramo (kg)</option>
                    <option value="litro">Litro (L)</option>
                    <option value="gramo">Gramo (g)</option>
                  </select>
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

      {/* Modal presentaciones */}
      {modalPres && productoPres && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-800">
                Presentaciones · {productoPres.nombre}
              </h2>
              <button onClick={cerrarModalPres} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 py-4 space-y-4">

              {/* Lista de presentaciones */}
              {presentaciones.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Sin presentaciones. Al crear una, será la primera.
                </p>
              ) : (
                <div className="space-y-3">
                  {presentaciones.map(pres => (
                    <div
                      key={pres.id}
                      className={`border rounded-xl p-4 ${editandoPres?.id === pres.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{pres.nombre}</p>
                            {pres.es_venta_defecto === 1 && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Venta</span>
                            )}
                            {pres.es_compra_defecto === 1 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Compra</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                            <p>1 {pres.nombre} = {pres.unidades_por_paquete} {productoPres.unidad || 'unidad'}{pres.unidades_por_paquete !== 1 ? 'es' : ''}</p>
                            <p>Venta: {formatGs(pres.precio_venta)} · Compra: {formatGs(pres.precio_compra)}</p>
                            {pres.codigo_barras && <p className="font-mono text-xs">Código: {pres.codigo_barras}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-3">
                          <button
                            onClick={() => editarPres(pres)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarPres(pres.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulario agregar/editar presentación */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {editandoPres ? 'Editar presentación' : 'Nueva presentación'}
                </h3>
                <form onSubmit={handleSubmitPres} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={formPres.nombre}
                        onChange={e => setFormPres({ ...formPres, nombre: e.target.value })}
                        placeholder="Ej: Paquete x4, Unidad, etc."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unidades por paquete *
                      </label>
                      <input
                        type="number"
                        value={formPres.unidades_por_paquete}
                        onChange={e => setFormPres({ ...formPres, unidades_por_paquete: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
                      <input
                        type="text"
                        value={formPres.codigo_barras}
                        onChange={e => setFormPres({ ...formPres, codigo_barras: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio venta</label>
                      <input
                        type="number"
                        value={formPres.precio_venta}
                        onChange={e => setFormPres({ ...formPres, precio_venta: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Precio compra</label>
                      <input
                        type="number"
                        value={formPres.precio_compra}
                        onChange={e => setFormPres({ ...formPres, precio_compra: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="0"
                      />
                    </div>
                    <div className="col-span-2 flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPres.es_venta_defecto}
                          onChange={e => setFormPres({ ...formPres, es_venta_defecto: e.target.checked })}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        Presentación por defecto en ventas
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formPres.es_compra_defecto}
                          onChange={e => setFormPres({ ...formPres, es_compra_defecto: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Presentación por defecto en compras
                      </label>
                    </div>
                  </div>

                  {errorPres && (
                    <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {errorPres}
                    </p>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setEditandoPres(null); setFormPres({
                        nombre: '', unidades_por_paquete: '1', precio_venta: '', precio_compra: '',
                        codigo_barras: '', es_venta_defecto: false, es_compra_defecto: false
                      }); setErrorPres('') }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      {editandoPres ? 'Cancelar edición' : 'Limpiar'}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {editandoPres ? 'Guardar' : 'Agregar presentación'}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Productos