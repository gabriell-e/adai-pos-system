/**
 * Crea un respaldo VERIFICADO de la base de datos.
 *
 * Por qué no se copia el archivo a mano: la base está en modo WAL, o sea que
 * parte de lo más reciente todavía vive en adai.db-wal. Copiar el .db a mano
 * guarda una base incompleta (y abrirla puede darla por corrupta). Por eso se
 * usa la API de backup de SQLite, que arma un archivo consistente.
 *
 * Imprime un resumen en JSON para que el script de PowerShell lo revise
 * antes de subirlo a la nube. Sale con código distinto de 0 si algo falla.
 *
 * Uso: node crear-respaldo.js <archivo_destino.db>
 */
const fs   = require('fs')
const path = require('path')

const RAIZ    = path.join(__dirname, '..', '..')
const SERVER  = path.join(RAIZ, 'server')
const DB_PATH = path.join(SERVER, 'adai.db')

let Database
try {
  Database = require(path.join(SERVER, 'node_modules', 'better-sqlite3'))
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: 'No se encontró better-sqlite3. ¿Faltan las dependencias del server? Ejecutá npm install en la carpeta server.' }))
  process.exit(1)
}

const destino = process.argv[2]
if (!destino) {
  console.error(JSON.stringify({ ok: false, error: 'Falta indicar el archivo destino' }))
  process.exit(1)
}

const fallo = (error, codigo = 1) => {
  console.error(JSON.stringify({ ok: false, error }))
  process.exit(codigo)
}

const main = async () => {
  if (!fs.existsSync(DB_PATH)) fallo(`No se encontró la base en ${DB_PATH}`)

  // Si ya existe un destino viejo, se borra antes: db.backup() no lo pisa.
  if (fs.existsSync(destino)) fs.unlinkSync(destino)

  let db
  try {
    // Abrir en lectura y escritura es necesario para la API de backup.
    // Es seguro aunque ADAI POS esté abierto: SQLite admite varios lectores
    // en modo WAL, y acá no se escribe nada en la base.
    db = new Database(DB_PATH)
    await db.backup(destino)
  } catch (e) {
    if (db) { try { db.close() } catch (_) {} }
    fallo(`No se pudo crear el respaldo: ${e.message}`)
  }

  try { db.close() } catch (_) {}

  if (!fs.existsSync(destino)) fallo('El archivo de respaldo no se generó')

  // ─── Verificación: nunca subir algo que no se pudo leer ────────────────
  let d
  try {
    d = new Database(destino, { readonly: true, fileMustExist: true })
  } catch (e) {
    fs.unlinkSync(destino)
    fallo(`El respaldo generado no se puede abrir: ${e.message}`, 2)
  }

  let resumen
  try {
    const integridad = d.pragma('integrity_check', { simple: true })
    const integridadRapida = d.pragma('quick_check', { simple: true })

    if (integridad !== 'ok' || integridadRapida !== 'ok') {
      d.close()
      fs.unlinkSync(destino)
      fallo(`El respaldo salió corrupto (${integridad}) y fue descartado`, 2)
    }

    const contar = t => {
      try { return d.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n } catch (_) { return 0 }
    }

    const monto = d.prepare(
      "SELECT COALESCE(SUM(total), 0) t FROM ventas WHERE estado = 'completada'"
    ).get().t

    resumen = {
      ok: true,
      archivo: path.basename(destino),
      bytes: fs.statSync(destino).size,
      integridad,
      ventas: contar('ventas'),
      productos: contar('productos'),
      clientes: contar('clientes'),
      caja: contar('caja'),
      gastos: contar('gastos'),
      monto_ventas: Math.round(monto),
      tablas: d.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").get().n
    }
  } catch (e) {
    d.close()
    try { fs.unlinkSync(destino) } catch (_) {}
    fallo(`No se pudo verificar el respaldo: ${e.message}`, 2)
  }
  d.close()

  // Aviso, no error: una base recién creada puede no tener ventas todavía.
  if (resumen.ventas === 0) {
    resumen.advertencia = 'El respaldo no tiene ventas. Verificá que sea la base correcta.'
  }

  console.log(JSON.stringify(resumen))
}

main().catch(e => fallo(e.message))
