import { useState, useEffect } from 'react'
import api from '../api/axios'

const ConfigEmail = () => {
  const [config, setConfig]     = useState(null)
  const [form, setForm]         = useState({})
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando]   = useState(false)
  const [mensaje, setMensaje]     = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    api.get('/respaldos/config')
      .then(({ data }) => {
        setConfig(data)
        setForm({
          email_remitente:     data.email_remitente,
          email_app_password:  data.email_app_password,
          email_destinatarios: data.email_destinatarios,
          frecuencia_dias:     data.frecuencia_dias,
          aviso_email_activo:  data.aviso_email_activo
        })
      })
      .catch(err => setError(err.response?.data?.error || 'Error al cargar la configuración'))
  }, [])

  const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }))

  const guardar = async () => {
    setGuardando(true); setError(''); setMensaje(null)
    try {
      const { data } = await api.put('/respaldos/config', form)
      setConfig(data)
      setMensaje({ ok: true, texto: 'Configuración guardada' })
      setForm(f => ({ ...f, email_app_password: data.email_app_password }))
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // "Guardar y probar": primero guarda, porque si no se probaría
  // la configuración vieja y el usuario creería que todo funciona.
  const probar = async () => {
    setProbando(true); setGuardando(true); setError(''); setMensaje(null)
    try {
      const { data: guardado } = await api.put('/respaldos/config', form)
      setConfig(guardado)
      setForm(f => ({ ...f, email_app_password: guardado.email_app_password }))

      const { data } = await api.post('/respaldos/config/probar')
      setMensaje({
        ok: true,
        texto: `Configuración guardada y correo de prueba enviado a ${data.destinatarios.join(', ')}. Revisá la bandeja (y la spam).`
      })
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar el correo')
    } finally {
      setGuardando(false)
      setProbando(false)
    }
  }

  const claseInput = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Aviso por correo</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Cada cierto tiempo te llega un correo avisando que hay un respaldo nuevo.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900">
        <p className="font-medium mb-1">ℹ️ El archivo NO se manda por correo</p>
        <p>
          Solo se envía el aviso. La base de datos contiene nombres de clientes, RUC/CI y todo el
          historial de ventas, y eso no debería quedar dando vueltas en una bandeja de entrada.
          Bajala vos con el botón <strong>Descargar</strong>.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
        <p className="font-medium mb-1">🔑 Cómo conseguir la contraseña de aplicación</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Entrá a <code className="text-xs bg-amber-100 px-1 rounded">myaccount.google.com/apppasswords</code> con tu cuenta de Gmail</li>
          <li>Activá la verificación en 2 pasos si no la tenés</li>
          <li>Creá una contraseña de aplicación llamada "Adai POS"</li>
          <li>Gmail te da 16 caracteres separados en grupos de 4. <strong>Quitalos los espacios</strong></li>
        </ol>
        <p className="mt-1.5">No es tu contraseña normal de Gmail, sino esa nueva de 16 caracteres.</p>
      </div>

      {!config ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email remitente</label>
              <input
                type="email"
                placeholder="adaipositario@gmail.com"
                value={form.email_remitente || ''}
                onChange={e => set('email_remitente', e.target.value)}
                className={claseInput}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña de aplicación</label>
              <input
                type="text"
                placeholder="16 caracteres sin espacios"
                value={form.email_app_password || ''}
                onChange={e => set('email_app_password', e.target.value)}
                className={claseInput}
              />
              {config.tiene_password && form.email_app_password === '********' && (
                <p className="text-xs text-gray-400 mt-1">Dejala como está para no cambiarla</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinatarios</label>
              <input
                type="text"
                placeholder="correo1@gmail.com, correo2@gmail.com"
                value={form.email_destinatarios || ''}
                onChange={e => set('email_destinatarios', e.target.value)}
                className={claseInput}
              />
              <p className="text-xs text-gray-400 mt-1">Separados por coma</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avisar cada cuántos días</label>
              <input
                type="number"
                min="1"
                max="90"
                value={form.frecuencia_dias || 7}
                onChange={e => set('frecuencia_dias', e.target.value)}
                className={claseInput}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.aviso_email_activo}
              onChange={e => set('aviso_email_activo', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-700">Activar el aviso automático por correo</span>
          </label>

          {config.ultimo_aviso_en && (
            <p className="text-xs text-gray-400">
              Último aviso: {new Date(config.ultimo_aviso_en).toLocaleString('es-PY')}
            </p>
          )}

          {mensaje && (
            <p className={`rounded-lg px-3 py-2 text-sm border ${
              mensaje.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
            }`}>{mensaje.texto}</p>
          )}
          {error && (
            <p className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={probar}
              disabled={probando}
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {probando ? 'Enviando...' : 'Guardar y probar conexión'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ConfigEmail
