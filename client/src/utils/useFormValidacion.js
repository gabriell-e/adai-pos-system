import { useState } from 'react'
import { tienePeligrosos } from './validar'

const useFormValidacion = (valoresIniciales, reglas) => {
  const [form, setForm]     = useState(valoresIniciales)
  const [errores, setErrores] = useState({})

  const handleChange = (campo, valor) => {
    // Bloquea caracteres peligrosos en cualquier campo
    if (tienePeligrosos(valor)) return

    setForm(prev => ({ ...prev, [campo]: valor }))

    // Limpia el error del campo cuando el usuario empieza a corregir
    if (errores[campo]) {
      setErrores(prev => ({ ...prev, [campo]: '' }))
    }
  }

  const validar = () => {
    const nuevosErrores = {}

    for (const [campo, regla] of Object.entries(reglas)) {
      const valor = form[campo]

      if (regla.requerido && !valor?.toString().trim()) {
        nuevosErrores[campo] = `${regla.label} es obligatorio`
        continue
      }

      if (valor && regla.validador && !regla.validador(valor)) {
        nuevosErrores[campo] = regla.mensaje
      }

      if (valor && regla.minLength && valor.length < regla.minLength) {
        nuevosErrores[campo] = `Mínimo ${regla.minLength} caracteres`
      }

      if (valor && regla.maxLength && valor.length > regla.maxLength) {
        nuevosErrores[campo] = `Máximo ${regla.maxLength} caracteres`
      }
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const resetear = (nuevosValores = valoresIniciales) => {
    setForm(nuevosValores)
    setErrores({})
  }

  return { form, errores, handleChange, validar, resetear }
}

export default useFormValidacion