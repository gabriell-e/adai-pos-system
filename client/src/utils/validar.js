// Solo letras, espacios, tildes y caracteres comunes de nombres
export const soloTexto = valor =>
  /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(valor)

// Solo números y guión (formato RUC/CI paraguayo: 1234567-8)
export const soloRucCi = valor =>
  /^[0-9-]+$/.test(valor)

// Solo números, +, espacios y guiones (teléfonos)
export const soloTelefono = valor =>
  /^[0-9+\s-]+$/.test(valor)

// Email básico
export const esEmail = valor =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)

// Bloquea caracteres peligrosos en cualquier campo
export const tienePeligrosos = valor =>
  /[<>"'`;]/.test(valor)

// Sanitiza espacios extra
export const limpiar = valor =>
  valor.trim().replace(/\s+/g, ' ')