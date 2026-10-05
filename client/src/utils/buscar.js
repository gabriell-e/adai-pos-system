// Busqueda de productos con prioridad, para que al escribir "leche" salgan
// primero los que se llaman "Leche", no "Crema de leche" ni "Desodorante para
// piso leche".
//
// Antes el filtro era un includes() a secas y se quedaba con el orden en que
// venia la lista, ademas de cortarse en 6 resultados: por eso los productos
// correctos a veces ni aparecian.

// Quita acentos y pasa a minusculas, para que "jabon" encuentre "Jabon"
const normalizar = texto => String(texto || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const escapar = texto => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "leche" tiene que ser una palabra suelta: "Leche entera" y "Crema de leche"
// sirven, "Lechero" no, porque ahi "leche" es parte de otra palabra.
const ES_PALABRA        = t => new RegExp(`(^|[\\s\\-/_(])${escapar(t)}([\\s\\-/_(]|$)`)
const EMPIEZA_PALABRA   = t => new RegExp(`^${escapar(t)}([\\s\\-/_(]|$)`)

// Prioridades, de mejor a peor
export const PRIORIDAD = {
  exacto:       1000,  // "Leche"
  empieza:       900,  // "Leche entera"
  empiezaTerm:   800,  // "Leche deslactosada"
  palabra:       700,  // "Crema de leche"
  pegado:        600,  // "Lechero", "Pino leche"
  codigo:        950   // codigo de barras o coincidencia exacta de codigo
}

/**
 * Puntua un producto contra lo que se escribio.
 * Devuelve null cuando el producto no coincide con nada de lo buscado.
 * A mayor puntaje, mejor coincidencia.
 */
export const puntuarProducto = (producto, consulta) => {
  const q = normalizar(consulta).trim()
  if (!q) return null

  const terminos = q.split(/\s+/).filter(Boolean)
  const nombre   = normalizar(producto.nombre)
  const codigo   = String(producto.codigo_barras || '').trim()

  const enNombre = terminos.every(t => nombre.includes(t))
  const enCodigo = terminos.length === 1 && codigo.includes(q)
  if (!enNombre && !enCodigo) return null

  // El nombre corto primero desempata: "Crema de leche" antes que
  // "Desodorante para piso leche"
  const largo = Math.min(90, nombre.length)

  if (!enNombre) return PRIORIDAD.codigo - largo
  if (nombre === q) return PRIORIDAD.exacto

  // La frase entera al principio, y terminada en palabra. Sin mirar el
  // caracter que sigue, "lechero" entraba por esta puerta y se colgaba arriba
  // de "Crema de leche".
  const sigueEnPalabra = nombre.length === q.length || /[\s\-/_(]/.test(nombre[q.length])
  if (nombre.startsWith(q) && sigueEnPalabra) return PRIORIDAD.empieza - largo

  if (terminos.some(t => EMPIEZA_PALABRA(t).test(nombre))) return PRIORIDAD.empiezaTerm - largo
  if (terminos.some(t => ES_PALABRA(t).test(nombre))) return PRIORIDAD.palabra - largo
  return PRIORIDAD.pegado - largo
}

/**
 * Devuelve los productos que coinciden, ordenados por prioridad.
 * @param {Array}  productos
 * @param {string} consulta
 * @param {number} limite  cuantos traer; null para todos
 */
export const buscarProductos = (productos, consulta, limite = null) => {
  const q = normalizar(consulta).trim()
  if (!q) return []

  const conPuntaje = []
  for (const p of productos) {
    const puntaje = puntuarProducto(p, consulta)
    if (puntaje !== null) conPuntaje.push({ p, puntaje })
  }

  conPuntaje.sort((a, b) => (b.puntaje - a.puntaje) || a.p.nombre.localeCompare(b.p.nombre, 'es'))

  const lista = conPuntaje.map(x => x.p)
  return limite ? lista.slice(0, limite) : lista
}

/**
 * Lo mismo que puntuarProducto, pero para cualquier otra cosa (clientes,
 * proveedores, categorías). Busca en los campos que se le pasen en vez de
 * nombre y código, y usa la misma escalera de prioridades.
 *
 * Se agregó porque los buscadores de esas pantallas filtraban con un
 * includes() a secas: no entendían acentos ("jose" no encontraba "José") y
 * dejaban el orden en que venía la lista.
 *
 * @param {object} item
 * @param {string} consulta
 * @param {Array<{ campo: string, peso: number }>} campos  peso menor = mejor
 */
export const puntuarTexto = (item, consulta, campos) => {
  const q = normalizar(consulta).trim()
  if (!q) return null

  const terminos = q.split(/\s+/).filter(Boolean)

  for (const { campo, peso } of campos) {
    const valor = normalizar(item[campo])
    if (!valor) continue
    if (!terminos.every(t => valor.includes(t))) continue

    // Todos los términos juntos y en orden = lo que el usuario escribió
    if (valor === q) return peso - 0

    const largo = Math.min(90, valor.length)
    const sigueEnPalabra = valor.length === q.length || /[\s\-/_(]/.test(valor[q.length])

    if (valor.startsWith(q) && sigueEnPalabra)       return peso + PRIORIDAD.empieza - largo
    if (terminos.some(t => EMPIEZA_PALABRA(t).test(valor))) return peso + PRIORIDAD.empiezaTerm - largo
    if (terminos.some(t => ES_PALABRA(t).test(valor)))      return peso + PRIORIDAD.palabra - largo
    return peso + PRIORIDAD.pegado - largo
  }

  return null
}

/**
 * Filtra y ordena cualquier lista usando puntuarTexto.
 * @param {Array}   items
 * @param {string}  consulta
 * @param {Array}   campos   [{ campo, peso }], en orden de preferencia
 * @param {Function} etiqueta  para desempate alfabético (por defecto, nombre)
 */
export const buscarTexto = (items, consulta, campos, etiqueta = i => i.nombre) => {
  const q = normalizar(consulta).trim()
  if (!q) return items

  const conPuntaje = []
  for (const item of items) {
    const puntaje = puntuarTexto(item, consulta, campos)
    if (puntaje !== null) conPuntaje.push({ item, puntaje })
  }

  conPuntaje.sort((a, b) =>
    (b.puntaje - a.puntaje) || String(etiqueta(a.item)).localeCompare(String(etiqueta(b.item)), 'es'))

  return conPuntaje.map(x => x.item)
}
