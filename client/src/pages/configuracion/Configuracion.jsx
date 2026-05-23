import { useState, useEffect } from 'react'
import api from '../../api/axios'
import useFormValidacion from '../../utils/useFormValidacion'
import { soloTelefono, limpiar } from '../../utils/validar'

const valoresIniciales = {
  razon_social:         '',
  ruc:                  '',
  direccion:            '',
  telefono:             '',
  timbrado:             '',
  timbrado_inicio:      '',
  timbrado_vencimiento: '',
  factura_desde:        '1',
  punto_expedicion:     '001',
  establecimiento:      '001'
}

const reglas = {
  razon_social: { label: 'La razón social', requerido: true,  maxLength: 100 },
  ruc:          { label: 'El RUC',          requerido: true,  maxLength: 20  },
  timbrado:     { label: 'El timbrado',     requerido: true,  maxLength: 20  },
  timbrado_inicio: { label: 'El inicio del timbrado', requerido: true },
  telefono: {
    label:     'Teléfono',
    requerido: false,
    validador: soloTelefono,
    mensaje:   'Solo números, +, espacios y guiones'
  }
}

const Configuracion = () => {
  const [cargando, setCargando]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito]         = useState(false)
  const [errorApi, setErrorApi]   = useState('')

  const { form, errores, handleChange, validar, resetear } =
    useFormValidacion(valoresIniciales, reglas)

  useEffect(() => {
    api.get('/configuracion')
      .then(res => {
        const c = res.data
        resetear({
          razon_social:         c.razon_social         || '',
          ruc:                  c.ruc                  || '',
          direccion:            c.direccion             || '',
          telefono:             c.telefono              || '',
          timbrado:             c.timbrado              || '',
          timbrado_inicio:      c.timbrado_inicio?.slice(0, 10) || '',
          timbrado_vencimiento: c.timbrado_vencimiento?.slice(0, 10) || '',
          factura_desde:        String(c.factura_desde  ?? 1),
          punto_expedicion:     c.punto_expedicion      || '001',
          establecimiento:      c.establecimiento       || '001'
        })
      })
      .catch(() => {}) // Si no existe config aún, formulario vacío
      .finally(() => setCargando(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorApi('')
    setExito(false)
    if (!validar()) return

    setGuardando(true)
    try {
      await api.post('/configuracion', {
        razon_social:         limpiar(form.razon_social),
        ruc:                  form.ruc.trim(),
        direccion:            form.direccion  || null,
        telefono:             form.telefono   || null,
        timbrado:             form.timbrado.trim(),
        timbrado_inicio:      form.timbrado_inicio,
        timbrado_vencimiento: form.timbrado_vencimiento || null,
        factura_desde:        Number(form.factura_desde) || 1,
        punto_expedicion:     form.punto_expedicion || '001',
        establecimiento:      form.establecimiento  || '001'
      })
      setExito(true)
      setTimeout(() => setExito(false), 3000)
    } catch (err) {
      setErrorApi(err.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-400">Cargando configuración...</p>
    </div>
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Datos del negocio y facturación</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Datos del negocio */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Datos del negocio
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.razon_social}
              onChange={e => handleChange('razon_social', e.target.value)}
              placeholder="Ej: Despensa Adai"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                ${errores.razon_social ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}`}
            />
            {errores.razon_social && <p className="text-red-500 text-xs mt-1">{errores.razon_social}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.ruc}
                onChange={e => handleChange('ruc', e.target.value)}
                placeholder="Ej: 1234567-8"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  ${errores.ruc ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}`}
              />
              {errores.ruc && <p className="text-red-500 text-xs mt-1">{errores.ruc}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={e => handleChange('telefono', e.target.value)}
                placeholder="Ej: 0981000000"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  ${errores.telefono ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}`}
              />
              {errores.telefono && <p className="text-red-500 text-xs mt-1">{errores.telefono}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text"
              value={form.direccion}
              onChange={e => handleChange('direccion', e.target.value)}
              placeholder="Ej: Lambaré, Central, Paraguay"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Datos de facturación */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Facturación (SET)
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Establecimiento
              </label>
              <input
                type="text"
                value={form.establecimiento}
                onChange={e => handleChange('establecimiento', e.target.value)}
                placeholder="001"
                maxLength={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Punto de expedición
              </label>
              <input
                type="text"
                value={form.punto_expedicion}
                onChange={e => handleChange('punto_expedicion', e.target.value)}
                placeholder="001"
                maxLength={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timbrado <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.timbrado}
              onChange={e => handleChange('timbrado', e.target.value)}
              placeholder="Ej: 12345678"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                ${errores.timbrado ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}`}
            />
            {errores.timbrado && <p className="text-red-500 text-xs mt-1">{errores.timbrado}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inicio timbrado <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.timbrado_inicio}
                onChange={e => handleChange('timbrado_inicio', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  ${errores.timbrado_inicio ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}`}
              />
              {errores.timbrado_inicio && <p className="text-red-500 text-xs mt-1">{errores.timbrado_inicio}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vencimiento timbrado
              </label>
              <input
                type="date"
                value={form.timbrado_vencimiento}
                onChange={e => handleChange('timbrado_vencimiento', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de factura inicial
            </label>
            <input
              type="number"
              value={form.factura_desde}
              onChange={e => handleChange('factura_desde', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min="1"
            />
            <p className="text-xs text-gray-400 mt-1">
              Este número se incrementa automáticamente con cada venta
            </p>
          </div>
        </div>

        {errorApi && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorApi}
          </p>
        )}

        {exito && (
          <p className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✅ Configuración guardada correctamente
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={guardando}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {guardando ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>

      </form>
    </div>
  )
}

export default Configuracion