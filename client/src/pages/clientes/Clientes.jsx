import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import useFormValidacion from '../../utils/useFormValidacion'
import { soloTexto, soloRucCi, soloTelefono, esEmail, limpiar } from '../../utils/validar'

const valoresIniciales = { nombre: '', ruc_ci: '', telefono: '', email: '' }

const reglas = {
  nombre: {
    label:     'El nombre',
    requerido: true,
    validador: soloTexto,
    mensaje:   'Solo se permiten letras y espacios',
    maxLength: 100
  },
  ruc_ci: {
    label:     'RUC/CI',
    requerido: false,
    validador: soloRucCi,
    mensaje:   'Solo numeros y guion. Ej: 1234567-8'
  },
  telefono: {
    label:     'Telefono',
    requerido: false,
    validador: soloTelefono,
    mensaje:   'Solo numeros, +, espacios y guiones'
  },
  email: {
    label:     'Email',
    requerido: false,
    validador: esEmail,
    mensaje:   'Formato de email invalido'
  }
}

const Clientes = () => {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState(null)
  const [errorApi, setErrorApi] = useState('')
  const busquedaRef = useRef()

  const { form, errores, handleChange, validar, resetear } = useFormValidacion(valoresIniciales, reglas)

  const cargarDatos = async () => {
    try {
      const { data } = await api.get('/clientes')
      setClientes(data)
    } catch (err) {
      setErrorApi('Error al cargar clientes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const abrirModal = (cliente = null) => {
    if (cliente) {
      setEditando(cliente)
      resetear({
        nombre:   cliente.nombre,
        ruc_ci:   cliente.ruc_ci   || '',
        telefono: cliente.telefono || '',
        email:    cliente.email    || ''
      })
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
      const payload = {
        nombre:   limpiar(form.nombre),
        ruc_ci:   form.ruc_ci   || null,
        telefono: form.telefono || null,
        email:    form.email    || null
      }
      if (editando) {
        await api.put(`/clientes/${editando.id}`, payload)
      } else {
        await api.post('/clientes', payload)
      }
      await cargarDatos()
      cerrarModal()
    } catch (err) {
      setErrorApi(err.response?.data?.error || 'Error al guardar')
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await api.delete(`/clientes/${id}`)
      await cargarDatos()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  const formatGs = n => `Gs. ${Number(n).toLocaleString('es-PY')}`
  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.ruc_ci?.includes(busqueda) ||
    c.telefono?.includes(busqueda)
  )

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando clientes...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientes.length} clientes registrados</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="mb-4">
        <input
          ref={busquedaRef}
          type="text"
          placeholder="Buscar por nombre, RUC/CI o telefono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">RUC / CI</th>
              <th className="px-4 py-3 text-left">Telefono</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-right">Deuda</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron clientes
                </td>
              </tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{c.ruc_ci   || <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-gray-600">{c.telefono || <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-gray-600">{c.email    || <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-right">
                  {c.deuda_total > 0
                    ? <span className="text-red-600 font-medium">{formatGs(c.deuda_total)}</span>
                    : <span className="text-gray-300">-</span>
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => abrirModal(c)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Editar
                    </button>
                    {esAdmin && (
                      <button
                        onClick={() => eliminar(c.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Eliminar
                      </button>
                    )}
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
                {editando ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl">X</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {[
                { campo: 'nombre',   label: 'Nombre',    tipo: 'text',  placeholder: 'Ej: Juan Perez',        requerido: true  },
                { campo: 'ruc_ci',   label: 'RUC / CI',  tipo: 'text',  placeholder: 'Ej: 1234567-8',         requerido: false },
                { campo: 'telefono', label: 'Telefono',  tipo: 'text',  placeholder: 'Ej: 0981000000',        requerido: false },
                { campo: 'email',    label: 'Email',     tipo: 'email', placeholder: 'Ej: cliente@email.com', requerido: false },
              ].map(({ campo, label, tipo, placeholder, requerido }) => (
                <div key={campo}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} {requerido && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type={tipo}
                    value={form[campo]}
                    onChange={e => handleChange(campo, e.target.value)}
                    placeholder={placeholder}
                    className={`
                      w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                      ${errores[campo]
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-gray-300 focus:ring-emerald-500'}
                    `}
                  />
                  {errores[campo] && (
                    <p className="text-red-500 text-xs mt-1">{errores[campo]}</p>
                  )}
                </div>
              ))}
              {errorApi && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorApi}
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={cerrarModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                  {editando ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clientes
