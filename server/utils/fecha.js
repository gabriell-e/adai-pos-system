const ahora = () =>
  new Date().toLocaleString('sv-SE', { timeZone: 'America/Asuncion' }).replace('T', ' ')

module.exports = { ahora }