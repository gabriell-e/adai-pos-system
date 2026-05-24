import { useState, useEffect } from 'react'
import api from '../../api/axios'
import useFormValidacion from '../../utils/useFormValidacion'
import { soloTexto, limpiar } from '../../utils/validar'

const valoresIniciales = { nombre: '' }

const reglas = {
  nombre: {
    label:     'El nombre',
    requerido: true,
    validador: soloTexto,
    mensaje:   'Solo se permiten letras y espacios',
    maxLength: 50
  }
}

const Categorias = () => {
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [modal, setModal]           = useState(false)
  const [editando, setEditando]     = useState(null)
  const [errorApi, setErrorApi]     = useState('')

  const { form, errores, handleChange, validar, resetear } = useFormValidacion(valoresIniciales, reglas)

  const cargarDatos = async () => {
    try {
      const { data } = await api.get('/categorias')
      setCategorias(data)
    } catch (err) {
      setErrorApi('Error al cargar categorías')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const abrirModal = (categoria = null) => {
    if (categoria) {
      setEditando(categoria)
      resetear({ nombre: categoria.nombre })
    } else {
      setEditando(null)
      resetear()
    }
    setErrorApi('')
    setModal(true)
  }

  const cerrarModal = () => {
    setModal(false)
    setEditando(null)
    setErrorApi('')
    resetear()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorApi('')
    if (!validar()) return

    try {
      const payload = { nombre: limpiar(form.nombre) }
      if (editando) {
        await api.put(`/categorias/${editando.id}`, payload)
      } else {
        await api.post('/categorias', payload)
      }
      await cargarDatos()
      cerrarModal()
    } catch (err) {
      setErrorApi(err.response?.data?.error || 'Error al guardar')
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await api.delete(`/categorias/${id}`)
      await cargarDatos()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  const filtrados = categorias.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando categorías...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Categorías</h1>
          <p className="text-sm text-gray-500 mt-0.5">{categorias.length} categorías registradas</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nueva categoría
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron categorías
                </td>
              </tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => abrirModal(c)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar(c.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => handleChange('nombre', e.target.value)}
                  placeholder="Ej: Bebidas"
                  className={`
                    w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                    ${errores.nombre
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 focus:ring-emerald-500'}
                  `}
                />
                {errores.nombre && (
                  <p className="text-red-500 text-xs mt-1">{errores.nombre}</p>
                )}
              </div>

              {errorApi && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorApi}
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
                  {editando ? 'Guardar cambios' : 'Crear categoría'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Categorias
