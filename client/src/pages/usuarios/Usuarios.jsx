import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const Usuarios = () => {
  const { usuario: currentUser } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'cajero' })

  const [modalPass, setModalPass] = useState(false)
  const [cambiandoPass, setCambiandoPass] = useState(null)
  const [passForm, setPassForm] = useState({ password_actual: '', password_nuevo: '' })

  const cargar = async () => {
    try {
      const { data } = await api.get('/usuarios')
      setUsuarios(data)
    } catch (err) {
      setError('Error al cargar usuarios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirModal = (u = null) => {
    if (u) {
      setEditando(u)
      setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol })
    } else {
      setEditando(null)
      setForm({ nombre: '', email: '', password: '', rol: 'cajero' })
    }
    setError('')
    setModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (editando) {
        await api.put(`/usuarios/${editando.id}`, {
          nombre: form.nombre,
          email: form.email,
          rol: form.rol
        })
      } else {
        if (!form.password) return setError('La contraseña es obligatoria')
        await api.post('/usuarios', form)
      }
      await cargar()
      setModal(false)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    }
  }

  const abrirPass = (u) => {
    setCambiandoPass(u)
    setPassForm({ password_actual: '', password_nuevo: '' })
    setError('')
    setModalPass(true)
  }

  const handleChangePass = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.patch(`/usuarios/${cambiandoPass.id}/password`, passForm)
      setModalPass(false)
      alert('Contraseña actualizada')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar contraseña')
    }
  }

  const desactivar = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return
    try {
      await api.delete(`/usuarios/${id}`)
      await cargar()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al desactivar')
    }
  }

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando usuarios...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{usuarios.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-center">Rol</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No hay usuarios</td>
              </tr>
            ) : usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => abrirModal(u)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Editar
                    </button>
                    <button onClick={() => abrirPass(u)} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                      Contraseña
                    </button>
                    {u.activo ? (
                      <button onClick={() => desactivar(u.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Desactivar
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">Inactivo</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar usuario */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editando ? 'Editar usuario' : 'Nuevo usuario'}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
              </div>
              {!editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required minLength={6} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="cajero">Cajero</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                  {editando ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cambiar contraseña */}
      {modalPass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Cambiar contraseña — {cambiandoPass?.nombre}
              </h2>
              <button onClick={() => setModalPass(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleChangePass} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <input type="password" value={passForm.password_actual} onChange={e => setPassForm({ ...passForm, password_actual: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input type="password" value={passForm.password_nuevo} onChange={e => setPassForm({ ...passForm, password_nuevo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required minLength={6} />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalPass(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Actualizar contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Usuarios