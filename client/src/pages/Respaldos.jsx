import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import ConfigEmail from './RespaldosConfig'

const formatFecha = f => new Date(f).toLocaleString('es-PY', { dateStyle: 'medium', timeStyle: 'short' })

const formatTamano = bytes => {
  if (!bytes) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const Respaldos = () => {
  const { usuario } = useAuth()
  const token = usuario?.token || localStorage.getItem('token')

  const [estado, setEstado]     = useState(null)
  const [lista, setLista]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState('')
  const [mensaje, setMensaje]   = useState(null)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState('lista')

  const cargar = async () => {
    try {
      const [e, l] = await Promise.all([api.get('/respaldos'), api.get('/respaldos/lista')])
      setEstado(e.data)
      setLista(l.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar los respaldos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const crearAhora = async () => {
    setTrabajando('crear'); setError(''); setMensaje(null)
    try {
      const { data } = await api.post('/respaldos')
      setMensaje({ ok: true, texto: `${data.mensaje}` })
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el respaldo')
    } finally {
      setTrabajando('')
    }
  }

  const descargar = archivo => {
    window.open(`/api/respaldos/descargar/${encodeURIComponent(archivo)}?token=${token}`, '_blank')
  }

  const eliminar = async archivo => {
    if (!confirm(`¿Eliminar el respaldo?\n\n${archivo}\n\nNo se puede deshacer.`)) return
    try {
      await api.delete(`/respaldos/${encodeURIComponent(archivo)}`)
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar')
    }
  }

  const restaurar = async (archivo, fecha, esViejo) => {
    // Se lee el respaldo antes de preguntar nada: sin esto, restaurar uno viejo
    // se ve igual que restaurar el bueno y se pierden datos sin avisar.
    let info
    try {
      const { data } = await api.get(`/respaldos/resumen/${encodeURIComponent(archivo)}`)
      info = data
    } catch {
      if (!confirm(`⚠️  RESTAURAR RESPALDO\n\n${archivo}\n\nNo se pudo leer el contenido del respaldo. ¿Continuar igual?`)) return
    }

    if (info) {
      if (!info.utilizable) {
        const sigue = confirm(
          `⛔  ESTE RESPALDO NO SE PUEDE USAR\n\n` +
          `   ${archivo}\n\n` +
          `Integridad: ${info.integridad}\n` +
          `Ventas: ${info.ventas ?? 0}\n\n` +
          `Si lo restaurás, la base queda sin datos.\n\n` +
          `¿Restaurar igual?`
        )
        if (!sigue) return
      } else {
        const lineas = [
          `   Ventas:  ${info.ventas}`,
          `   Monto:   Gs. ${Number(info.monto_ventas || 0).toLocaleString('es-PY')}`,
          `   Última venta: ${info.ultima_venta || 'sin fecha'}`
        ].join('\n')

        // Aviso fuerte si el respaldo es más viejo que el estado actual: casi
        // siempre eso es un error de dedo, no una intención.
        let atrasado = ''
        if (esViejo) {
          atrasado = `\n\n⚠️ Este respaldo es MÁS VIEJO que tu base actual. ` +
            `Vas a perder todo lo que se registró después.`
        }

        const ok = confirm(
          `⚠️  RESTAURAR RESPALDO\n\n` +
          `Se va a reemplazar TODA la base por la del:\n\n` +
          `   ${archivo}\n   ${fecha}\n\n` +
          `${lineas}${atrasado}\n\n` +
          `Antes de pisar se guarda el estado actual, así que se puede volver atrás.\n\n` +
          `¿Continuar?`
        )
        if (!ok) return
      }
    }

    setTrabajando('restaurar'); setError('')
    try {
      const { data } = await api.post(`/respaldos/restaurar/${encodeURIComponent(archivo)}`)
      setMensaje({ ok: true, texto: data.mensaje })
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo restaurar')
      setTrabajando('')
    }
  }

  if (cargando) return <div className="flex justify-center items-center h-64"><p className="text-gray-400">Cargando...</p></div>

  const hayRespaldo = lista.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Respaldos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Copias de seguridad de la base de datos
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'lista',  label: 'Respaldos' },
          { id: 'correo', label: 'Aviso por correo' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'correo' ? <ConfigEmail /> : <>
      {/* Aviso principal */}
      <div className={`rounded-xl border px-4 py-3 text-sm ${
        hayRespaldo
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}>
        {hayRespaldo ? (
          <p>
            <strong>✓ Hay {lista.length} respaldos</strong>
            {estado.dias_desde_ultimo === 0
              ? ' · el último es de hoy'
              : ` · el último es de hace ${estado.dias_desde_ultimo} día${estado.dias_desde_ultimo === 1 ? '' : 's'}`}
          </p>
        ) : (
          <p><strong>⚠ Todavía no hay ningún respaldo.</strong> Si algo sale mal ahora mismo, no hay forma de recuperar los datos.</p>
        )}
      </div>

      {/* Lo que realmente protege los datos */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
        <p className="font-medium mb-1">📌 El respaldo más importante es el que está en otro lugar</p>
        <p>
          Estos respaldos están en <code className="text-xs bg-amber-100 px-1 rounded">server\backups\</code>, o sea en la
          misma computadora. Si se rompe el disco, se pierden junto con el sistema. Bajá el respaldo a un{' '}
          <strong>USB</strong> de vez en cuando: eso es lo único que sobrevive a una incendio o un robo.
        </p>
      </div>

      {mensaje && (
        <p className={`rounded-lg px-3 py-2 text-sm border ${
          mensaje.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {mensaje.texto}
        </p>
      )}
      {error && (
        <p className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={crearAhora}
          disabled={!!trabajando}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {trabajando === 'crear' ? 'Creando...' : '💾 Hacer respaldo ahora'}
        </button>
        <button
          onClick={() => cargar()}
          className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Actualizar
        </button>
      </div>

      <div className="text-xs text-gray-400">
        Se conservan los 15 respaldos más recientes y 1 por día de los últimos 30 días.
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Archivo</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-right">Tamaño</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin respaldos todavía</td></tr>
            ) : lista.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.archivo}</td>
                <td className="px-4 py-3 text-gray-600">{formatFecha(r.creado_en)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatTamano(r.tamano)}</td>
                <td className="px-4 py-3 text-center">
                  {r.automatico
                    ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Auto</span>
                    : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Manual</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => descargar(r.archivo)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Descargar
                    </button>
                    <button
                      onClick={() => restaurar(
                      r.archivo,
                      formatFecha(r.creado_en),
                      r.archivo !== lista[0]?.archivo
                    )}
                      disabled={!!trabajando}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                    >
                      {trabajando === 'restaurar' ? 'Restaurando...' : 'Restaurar'}
                    </button>
                    <button
                      onClick={() => eliminar(r.archivo)}
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
      </>}
    </div>
  )
}

export default Respaldos
