import { useState, useEffect } from 'react'
import api from '../../api/axios'
import useFormValidacion from '../../utils/useFormValidacion'
import { soloTexto, soloRucCi, soloTelefono, esEmail, limpiar } from '../../utils/validar'

const valoresIniciales = { nombre: '', ruc: '', telefono: '', email: '' }

const reglas = {
  nombre: {
    label:     'El nombre',
    requerido: true,
    validador: soloTexto,
    mensaje:   'Solo se permiten letras y espacios',
    maxLength: 100
  },
  ruc: {
    label:     'RUC',
    requerido: false,
    validador: soloRucCi,
    mensaje:   'Solo números y guión. Ej: 80012345-6'
  },
  telefono: {
    label:     'Teléfono',
    requerido: false,
    validador: soloTelefono,
    mensaje:   'Solo números, +, espacios y guiones'
  },
  email: {
    label:     'Email',
    requerido: false,
    validador: esEmail,
    mensaje:   'Formato de email inválido'
  }
}

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando]       = useState(true)
  const [busqueda, setBusqueda]       = useState('')
  const [modal, setModal]             = useState(false)
  const [editando, setEditando]       = useState(null)
  const [errorApi, setErrorApi]       = useState('')

  const { form, errores, handleChange, validar, resetear } = useFormValidacion(valoresIniciales, reglas)

  const cargarDatos = async () => {
    try {
      const { data } = await api.get('/proveedores')
      setProveedores(data)
    } catch (err) {
      setErrorApi('Error al cargar proveedores')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const abrirModal = (proveedor = null) => {
    if (proveedor) {
      setEditando(proveedor)
      resetear({
        nombre:   proveedor.nombre,
        ruc:      proveedor.ruc      || '',
        telefono: proveedor.telefono || '',
        email:    proveedor.email    || ''
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
        ruc:      form.ruc      || null,
        telefono: form.telefono || null,
        email:    form.email    || null
      }
      if (editando) {
        await api.put(`/proveedores/${editando.id}`, payload)
      } else {
        await api.post('/proveedores', payload)
      }
      await cargarDatos()
      cerrarModal()
    } catch (err) {
      setErrorApi(err.response?.data?.error || 'Error al guardar')
    }
  }

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar este proveedor?')) return
    try {
      await api.delete(`/proveedores/${id}`)
      await cargarDatos()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al desactivar')
    }
  }

  const activar = async (id) => {
  if (!confirm('¿Activar este proveedor?')) return
  try {
    await api.patch(`/proveedores/${id}/activar`)
    await cargarDatos()
  } catch (err) {
    alert(err.response?.data?.error || 'Error al activar')
  }
}

  const filtrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.ruc?.includes(busqueda) ||
    p.telefono?.includes(busqueda)
  )

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando proveedores...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{proveedores.length} proveedores registrados</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo proveedor
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, RUC o teléfono..."
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
              <th className="px-4 py-3 text-left">RUC</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron proveedores
                </td>
              </tr>
            ) : filtrados.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{p.ruc      || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.telefono || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">{p.email    || <span className="text-gray-300">—</span>}</td>
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

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">

            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

              {[
                { campo: 'nombre',   label: 'Nombre',   tipo: 'text',  placeholder: 'Ej: Distribuidora Norte', requerido: true  },
                { campo: 'ruc',      label: 'RUC',      tipo: 'text',  placeholder: 'Ej: 80012345-6',          requerido: false },
                { campo: 'telefono', label: 'Teléfono', tipo: 'text',  placeholder: 'Ej: 0211000000',          requerido: false },
                { campo: 'email',    label: 'Email',    tipo: 'email', placeholder: 'Ej: contacto@dist.com',   requerido: false },
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
                  {editando ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Proveedores