// Quita acentos y pasa a minúsculas. Lo usan los buscadores del servidor para
// que "jose" encuentre "José" y "crema de leche" se Compare con "Crema de Leche".
//
// La misma lógica está en client/src/utils/buscar.js. Si se cambia una, hay que
// cambiar la otra: el usuario escribe una vez y espera el mismo resultado en las
// dos pantallas.
const normalizarTexto = texto => String(texto == null ? '' : texto)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

// Envoltorio tolerante: SQLite llama a la función con NULL cuando la columna es
// NULL, y String(null) daría "null", que haría matchear cualquier búsqueda.
const normalizarSql = texto => (texto == null ? '' : normalizarTexto(texto))

module.exports = { normalizarTexto, normalizarSql }