import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { numeroDecimal } from '../../utils/validar'

const formatGs    = n => `Gs. ${Number(n || 0).toLocaleString('es-PY')}`
const formatFecha = f => new Date(f).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })

const ICONOS = {
  'Alquiler': '🏠', 'Comida': '🍽️', 'Transporte': '🚗', 'Servicios': '💡',
  'Salud': '💊', 'Educación': '📚', 'Personal': '👤', 'Otros': '📦'
}

const Gastos = () => {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'

  const [gastos, setGastos]       = useState([])
  const [resumen, setResumen]     = useState(null)
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [modal, setModal]         = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [anulando, setAnulando]   = useState(null)

  const [filtros, setFiltros] = useState({
    desde: '', hasta: '', categoria: '', estado: 'registrado'
  })

  const [form, setForm] = useState({
    descripcion: '', monto: '', categoria: 'Otros'
  })

  const cargar = async () => {
    try {
      const params = {}
      if (filtros.desde)    params.fecha_desde = filtros.desde
      if (filtros.hasta)    params.fecha_hasta = filtros.hasta
      if (filtros.categoria) params.categoria   = filtros.categoria
      if (filtros.estado)   params.estado      = filtros.estado

      const { data } = await api.get('/gastos', { params })
      setGastos(data.gastos)
      setResumen(data.resumen)
      setCategorias(data.categorias)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar los gastos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [filtros])

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      await api.post('/gastos', {
        descripcion: form.descripcion,
        monto:       form.monto,
        categoria:   form.categoria,
        usuario_id:  usuario?.id
      })
      setForm({ descripcion: '', monto: '', categoria: 'Otros' })
      setModal(false)
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el gasto')
    } finally {
      setGuardando(false)
    }
  }

  const anular = async (gasto) => {
    const motivo = prompt(`Anular gasto\n\n"${gasto.descripcion}" — ${formatGs(gasto.monto)}\n\nMotivo (opcional):`)
    if (motivo === null) return
    setAnulando(gasto.id)
    setError('')
    try {
      await api.patch(`/gastos/${gasto.id}/anular`, { motivo: motivo || null })
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al anular')
    } finally {
      setAnulando(null)
    }
  }

  if (cargando) return <div className="flex justify-center items-center h-64"><p className="text-gray-400">Cargando...</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gastos Personales</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Dinero que sale de la caja para uso personal
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Registrar gasto
        </button>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">Total del filtro</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{formatGs(resumen.total_gastos)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{resumen.cantidad} gastos</p>
          </div>
          {resumen.anulados > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">Anulados</p>
              <p className="text-2xl font-bold text-gray-400 mt-1">{formatGs(resumen.monto_anulado)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{resumen.anulados} gastos</p>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm p-4 md:col-span-2">
            <p className="text-xs text-gray-500">Por categoría</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.keys(resumen.por_categoria).length === 0 ? (
                <span className="text-sm text-gray-400">Sin gastos</span>
              ) : Object.entries(resumen.por_categoria)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([cat, d]) => (
                  <span key={cat} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1 text-xs text-gray-700">
                    {ICONOS[cat] || '📦'} {cat}
                    <strong className="font-semibold">{formatGs(d.total)}</strong>
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date" value={filtros.desde}
          onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="date" value={filtros.hasta}
          onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={filtros.categoria}
          onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filtros.estado}
          onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="registrado">Registrados</option>
          <option value="anulado">Anulados</option>
          <option value="">Todos</option>
        </select>
        <button
          onClick={() => setFiltros({ desde: '', hasta: '', categoria: '', estado: 'registrado' })}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Limpiar
        </button>
      </div>

      {error && <p className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gastos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No hay gastos con estos filtros</td></tr>
            ) : gastos.map(g => (
              <tr key={g.id} className={`hover:bg-gray-50 ${g.estado === 'anulado' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="text-gray-800">{g.descripcion}</p>
                  {g.estado === 'anulado' && g.motivo_anulacion && (
                    <p className="text-xs text-gray-400">Anulado: {g.motivo_anulacion}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    {ICONOS[g.categoria] || '📦'} {g.categoria || 'Otros'}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  g.estado === 'anulado' ? 'text-gray-400 line-through' : 'text-red-600'
                }`}>
                  {formatGs(g.monto)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(g.creado_en)}</td>
                <td className="px-4 py-3 text-right">
                  {g.estado === 'registrado' && esAdmin ? (
                    <button
                      onClick={() => anular(g)}
                      disabled={anulando === g.id}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
                    >
                      {anulando === g.id ? 'Anulando...' : 'Anular'}
                    </button>
                  ) : g.estado === 'anulado' ? (
                    <span className="text-xs text-gray-400">Anulado</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Registrar gasto</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: Combustible del auto"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && guardar()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (Gs.) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: numeroDecimal(e.target.value) }))}
                  onKeyDown={e => e.key === 'Enter' && guardar()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <div className="grid grid-cols-4 gap-2">
                  {categorias.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, categoria: c }))}
                      className={`flex flex-col items-center py-2 rounded-lg border text-xs ${
                        form.categoria === c
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base">{ICONOS[c] || '📦'}</span>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando || !form.descripcion || !form.monto}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {guardando ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Gastos
