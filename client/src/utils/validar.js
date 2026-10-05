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

// Cantidades y precios con decimales.
//
// Estos campos NO pueden ser type="number". El navegador exige ahí el punto
// como separador decimal, así que al escribir "1,5" — que es como se escribe
// acá — el valor queda vacío y no se puede cargar media tonelada ni medio kilo.
// Con type="text" más inputMode="decimal" el móvil pone teclado numérico y la
// coma entra bien.
//
// Acepta "1,5", "1.5" y "1,50", y descarta letras y separadores de más.
export const numeroDecimal = valor => {
  let s = String(valor ?? '').replace(/,/g, '.')
  s = s.replace(/[^\d.]/g, '')

  const partes = s.split('.')
  if (partes.length > 2) s = partes[0] + '.' + partes.slice(1).join('')

  return s
}