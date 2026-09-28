const fs   = require('fs')
const path = require('path')

const LOCK = path.join(__dirname, '..', 'adai.lock')

const vigente = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

const liberar = () => {
  try {
    const actual = JSON.parse(fs.readFileSync(LOCK, 'utf8'))
    if (actual.pid === process.pid) fs.unlinkSync(LOCK)
  } catch (_) {}
}

// La base está en modo WAL y dos procesos abriendo el mismo archivo a la vez
// la dejan corrupta. Este control frena el segundo antes de tocar la base.
module.exports = function instanciaUnica() {
  if (fs.existsSync(LOCK)) {
    let anterior = null
    try { anterior = JSON.parse(fs.readFileSync(LOCK, 'utf8')) } catch (_) {}

    if (anterior?.pid && anterior.pid !== process.pid && vigente(anterior.pid)) {
      console.error('')
      console.error('❌ ADAI POS YA ESTÁ CORRIENDO')
      console.error('')
      console.error(`   Otro proceso (PID ${anterior.pid}) tiene la base de datos abierta.`)
      console.error(`   Arrancó ${anterior.iniciado || 'en este/u otro momento'}.`)
      console.error('')
      console.error('   Si abrís dos servidores a la vez la base se daña.')
      console.error('   Cerrá el otro servidor y volvé a iniciar, o usá Ctrl+C en esa ventana.')
      console.error('')
      process.exit(1)
    }
  }

  fs.writeFileSync(LOCK, JSON.stringify({
    pid: process.pid,
    iniciado: new Date().toLocaleString('es-PY')
  }))

  process.on('exit', liberar)
  process.on('SIGINT', () => { liberar(); process.exit(0) })
  process.on('SIGTERM', () => { liberar(); process.exit(0) })
}
