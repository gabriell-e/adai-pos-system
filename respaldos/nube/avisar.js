/**
 * Aviso por correo de que el respaldo de la nube se hizo bien.
 *
 * Reutiliza la configuración de Gmail que ya está guardada en
 * configuracion_backup (la misma que usa la pantalla Respaldos dentro de
 * ADAI POS), así que no hay que configurar el correo dos veces.
 *
 * Si no hay correo configurado, o si el envío falla, NO es un problema:
 * el respaldo ya está en Drive. Solo avisa por pantalla.
 *
 * Uso: node avisar.js <archivo> <ventas> <verificado true|false>
 */
const path = require('path')

const RAIZ   = path.join(__dirname, '..', '..')
const SERVER = path.join(RAIZ, 'server')

let Database, nodemailer
try {
  Database   = require(path.join(SERVER, 'node_modules', 'better-sqlite3'))
  nodemailer = require(path.join(SERVER, 'node_modules', 'nodemailer'))
} catch (_) {
  console.log('no hay dependencias instaladas en server')
  process.exit(0)
}

const archivo   = process.argv[2] || '(sin nombre)'
const ventas    = process.argv[3] || '0'
const verificado = String(process.argv[4]) === 'true'

const main = () => {
  const db = new Database(path.join(SERVER, 'adai.db'), { readonly: true, fileMustExist: true })

  const c = db.prepare('SELECT * FROM configuracion_backup WHERE id = 1').get()
  const cfg = db.prepare('SELECT razon_social FROM configuracion LIMIT 1').get()
  db.close()

  const destinatarios = String(c?.email_destinatarios || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!c?.email_remitente || !c?.email_app_password || !destinatarios.length) {
    console.log('correo no configurado, se omite el aviso')
    return
  }

  const transporte = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false,
    auth: { user: c.email_remitente, pass: c.email_app_password }
  })

  const asunto = verificado
    ? 'Adai POS - respaldo guardado en la nube'
    : 'Adai POS - ATENCIÓN: la copia en la nube no coincide'

  const cuerpo = verificado
    ? [
        'Buenas: el respaldo automático se hizo correctamente.',
        '',
        `Archivo: ${archivo}`,
        `Ventas incluidas: ${ventas}`,
        `Fecha: ${new Date().toLocaleString('es-PY')}`,
        '',
        'La copia ya está en Google Drive. Este correo es un aviso, no el respaldo.',
        'No hace falta que descargues nada, pero de vez en cuando mirá que los archivos estén.'
      ].join('\n')
    : [
        'El respaldo se creó, pero la copia subida a Drive no coincide con el archivo local.',
        '',
        `Archivo: ${archivo}`,
        'Puede ser un problema de internet durante la subida.',
        'La copia local en la carpeta server\\backups\\nube está bien.',
        'Mirá el log en respaldos\\nube\\respaldos.log para el detalle.'
      ].join('\n')

  transporte.sendMail({
    from: `"${cfg?.razon_social || 'Adai POS'}" <${c.email_remitente}>`,
    to: destinatarios.join(', '),
    subject: asunto,
    text: cuerpo
  }).then(() => {
    console.log(`enviado a ${destinatarios.length} destinatario(s)`)
  }).catch(e => {
    console.log(`fallo el envío: ${e.message}`)
  })
}

try { main() } catch (e) { console.log(`error: ${e.message}`) }
