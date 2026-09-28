const fs    = require('fs')
const path  = require('path')
const nodemailer = require('nodemailer')
const Database = require('better-sqlite3')

const { db } = require('../db')

// Los respaldos viven junto a la base, en server/backups/
const BACKUP_DIR   = path.join(__dirname, '..', 'backups')
const DB_PATH      = path.join(__dirname, '..', 'adai.db')

// Cuántos respaldos automáticos se conservan
const MANTENER_ULTIMOS   = 15
const MANTENER_DIAS      = 30

let intervalId = null

const asegurarDirectorio = () => {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
  return BACKUP_DIR
}

const nombreArchivo = (prefijo = 'auto') => {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `adai-${prefijo}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.db`
}

const registrar = ({ archivo, tamano, automatico }) => {
  db.prepare(`
    INSERT INTO respaldos (archivo, tamano, automatico)
    VALUES (?, ?, ?)
  `).run(archivo, tamano, automatico ? 1 : 0)
}

// ─── CREAR RESPALDO ────────────────────────────────────────────────────────
// IMPORTANTE: se usa db.backup() y NUNCA fs.copyFile().
// La base está en modo WAL, así que parte de los datos recientes viven
// todavía en adai.db-wal. Copiar el .db a mano guarda una base incompleta.
const crear = async ({ prefijo = 'auto', automatico = true } = {}) => {
  asegurarDirectorio()

  const archivo = nombreArchivo(prefijo)
  const destino  = path.join(BACKUP_DIR, archivo)

  await db.backup(destino)

  const { size } = fs.statSync(destino)
  registrar({ archivo, tamano: size, automatico })
  db.prepare('UPDATE configuracion_backup SET ultimo_respaldo_en = ? WHERE id = 1')
    .run(new Date().toLocaleString('sv-SE').replace('T', ' '))

  return { archivo, tamano: size, ruta: destino }
}

// ─── LISTAR ────────────────────────────────────────────────────────────────
const listar = () => {
  asegurarDirectorio()

  // Sincronizar con lo que realmente está en disco
  const enDisco = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'))
  const registrados = new Set(
    db.prepare('SELECT archivo FROM respaldos').all().map(r => r.archivo)
  )

  const registrarFaltantes = db.prepare(
    'INSERT OR IGNORE INTO respaldos (archivo, tamano, automatico) VALUES (?, ?, 0)'
  )

  for (const archivo of enDisco) {
    if (registrados.has(archivo)) continue
    const { size } = fs.statSync(path.join(BACKUP_DIR, archivo))
    registrarFaltantes.run(archivo, size)
  }

  return db.prepare(`
    SELECT * FROM respaldos
    ORDER BY creado_en DESC, id DESC
  `).all()
    .filter(r => fs.existsSync(path.join(BACKUP_DIR, r.archivo)))
    .map(r => ({ ...r, existe: true }))
}

const rutaDe = archivo => {
  const seguro = path.basename(archivo)
  const completa = path.join(BACKUP_DIR, seguro)
  if (!fs.existsSync(completa)) return null
  return completa
}

// Días desde el último respaldo.
// Se calcula dentro de SQLite a propósito: el DEFAULT de creado_en usa
// datetime('now','localtime') y Node puede estar con otra zona horaria,
// así que comparar los dos relojes da valores negativos.
const diasDesdeUltimo = () => {
  const r = db.prepare(`
    SELECT MAX(CAST(julianday('now', 'localtime') - julianday(creado_en) AS INTEGER)) AS dias
    FROM respaldos
  `).get()
  if (r?.dias === null || r?.dias === undefined) return null
  return Math.max(0, r.dias)
}

const obtener = archivo => {
  const r = db.prepare('SELECT * FROM respaldos WHERE archivo = ?').get(path.basename(archivo))
  if (!r) return null
  return { ...r, ruta: rutaDe(archivo) }
}

// ─── ELIMINAR ──────────────────────────────────────────────────────────────
const eliminar = archivo => {
  const nombre = path.basename(archivo)
  const completa = path.join(BACKUP_DIR, nombre)
  if (fs.existsSync(completa)) fs.unlinkSync(completa)
  db.prepare('DELETE FROM respaldos WHERE archivo = ?').run(nombre)
  return { mensaje: 'Respaldo eliminado' }
}

// ─── RETENCIÓN ─────────────────────────────────────────────────────────────
// Conserva los 15 automáticos más recientes + 1 por día de los últimos 30.
const aplicarRetencion = () => {
  asegurarDirectorio()

  const todos = db.prepare(`
    SELECT archivo FROM respaldos
    WHERE automatico = 1
    ORDER BY creado_en DESC, id DESC
  `).all()

  const aBorrar = new Set()
  const porDia  = new Map()

  todos.forEach((r, i) => {
    if (i < MANTENER_ULTIMOS) {
      const dia = r.archivo.match(/\d{4}-\d{2}-\d{2}/)?.[0]
      if (dia) {
        if (porDia.has(dia)) aBorrar.add(r.archivo)
        else porDia.set(dia, r.archivo)
      }
      return
    }

    const fecha = r.archivo.match(/\d{4}-\d{2}-\d{2}/)?.[0]
    if (!fecha) { aBorrar.add(r.archivo); return }

    const dias = (Date.now() - new Date(`${fecha}T00:00:00`).getTime()) / 86400000
    if (dias > MANTENER_DIAS || porDia.has(fecha)) aBorrar.add(r.archivo)
  })

  let borrados = 0
  for (const archivo of aBorrar) {
    const f = path.join(BACKUP_DIR, archivo)
    if (fs.existsSync(f)) { fs.unlinkSync(f); borrados++ }
    db.prepare('DELETE FROM respaldos WHERE archivo = ?').run(archivo)
  }

  return { evaluados: todos.length, borrados }
}

// ─── RESUMEN DE UN RESPALDO ────────────────────────────────────────────────
// Lee el respaldo en solo lectura para poder mostrar qué contiene antes de
// pisar la base. Sin esto, restaurar un respaldo viejo se ve igual que
// restaurar el bueno, y se pierden datos sin avisar.
const resumen = archivo => {
  const origen = rutaDe(archivo)
  if (!origen) throw new Error('El archivo de respaldo no existe')

  const bd = new Database(origen, { readonly: true, fileMustExist: true })
  try {
    const integridad = bd.pragma('integrity_check', { simple: true })

    const contar = tabla => {
      try { return bd.prepare(`SELECT COUNT(*) n FROM ${tabla}`).get().n }
      catch { return null }
    }

    const ventas = contar('ventas')
    let monto = null, ultima = null
    if (ventas) {
      const v = bd.prepare(`
        SELECT COALESCE(SUM(total),0) total, MAX(creado_en) ultima
        FROM ventas WHERE estado = 'completada'
      `).get()
      monto = Math.round(v.total)
      ultima = v.ultima
    }

    return {
      archivo,
      integridad,
      utilizable: integridad === 'ok' && (ventas || 0) > 0,
      tablas:   bd.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table'").get().n,
      ventas,
      monto_ventas: monto,
      ultima_venta:  ultima,
      productos: contar('productos'),
      clientes:  contar('clientes'),
      caja:      contar('caja'),
      gastos:    contar('gastos')
    }
  } finally {
    bd.close()
  }
}

// ─── RESTAURAR ─────────────────────────────────────────────────────────────
// Antes de pisar, se guarda el estado actual. Si algo sale mal, se vuelve.
const restaurar = async archivo => {
  const origen = rutaDe(archivo)
  if (!origen) throw new Error('El archivo de respaldo no existe')

  const previo = await crear({ prefijo: 'antes-restaurar', automatico: false })

  // Cerrar conexiones y reemplazar la base
  db.close()
  fs.copyFileSync(origen, DB_PATH)
  for (const sufijo of ['-wal', '-shm']) {
    const f = DB_PATH + sufijo
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }

  return {
    mensaje: 'Respaldo restaurado. Reiniciá el servidor para que los cambios surjan efecto.',
    respaldo_previo: previo.archivo
  }
}

// ─── EMAIL (solo aviso, nunca se manda la base) ────────────────────────────
const obtenerConfig = () => {
  const c = db.prepare('SELECT * FROM configuracion_backup WHERE id = 1').get()
  if (!c) return null
  return {
    email_remitente:     c.email_remitente    || '',
    email_destinatarios: c.email_destinatarios || '',
    frecuencia_dias:     c.frecuencia_dias,
    aviso_email_activo:  !!c.aviso_email_activo,
    ultimo_respaldo_en:  c.ultimo_respaldo_en,
    ultimo_aviso_en:     c.ultimo_aviso_en,
    // La contraseña nunca sale del servidor
    email_app_password:  c.email_app_password ? '********' : '',
    tiene_password:      !!c.email_app_password
  }
}

const guardarConfig = (datos) => {
  const actual = db.prepare('SELECT * FROM configuracion_backup WHERE id = 1').get() || {}

  const remitente   = datos.email_remitente    ?? actual.email_remitente ?? ''
  const destinat    = datos.email_destinatarios ?? actual.email_destinatarios ?? ''
  const frecuencia  = Number(datos.frecuencia_dias ?? actual.frecuencia_dias ?? 7)
  const activo      = datos.aviso_email_activo ? 1 : 0

  // Si viene enmascarado, se conserva la contraseña ya guardada
  let password = actual.email_app_password
  if (datos.email_app_password && datos.email_app_password !== '********') {
    password = datos.email_app_password
  }

  db.prepare(`
    UPDATE configuracion_backup SET
      email_remitente = ?, email_app_password = ?, email_destinatarios = ?,
      frecuencia_dias = ?, aviso_email_activo = ?
    WHERE id = 1
  `).run(remitente, password || '', destinat, frecuencia || 7, activo)

  return obtenerConfig()
}

const transporter = () => {
  const c = db.prepare('SELECT * FROM configuracion_backup WHERE id = 1').get()
  if (!c?.email_remitente)    throw new Error('Falta configurar el email remitente')
  if (!c?.email_app_password) throw new Error('Falta configurar la contraseña de aplicación')
  if (!c?.email_destinatarios)throw new Error('Falta configurar los destinatarios')

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: c.email_remitente, pass: c.email_app_password }
  })
}

const enviarAviso = async ({ prueba = false } = {}) => {
  const c = db.prepare('SELECT * FROM configuracion_backup WHERE id = 1').get()
  const cfg = db.prepare('SELECT razon_social FROM configuracion LIMIT 1').get()
  const destinatarios = String(c.email_destinatarios || '').split(',').map(s => s.trim()).filter(Boolean)
  const cantidadRespal = db.prepare('SELECT COUNT(*) c FROM respaldos').get().c

  await transporter().sendMail({
    from:    `"${cfg?.razon_social || 'Adai POS'}" <${c.email_remitente}>`,
    to:      destinatarios.join(', '),
    subject: prueba
      ? 'Adai POS - prueba de configuración de respaldos'
      : 'Adai POS - se creó un respaldo nuevo',
    text: prueba
      ? `Esta es una prueba.\n\nSi llegaste a este correo, la configuración del aviso de respaldos está funcionando correctamente.\n\nNo se envía la base de datos por correo. Descargala desde ADAI POS → Respaldos.`
      : `Hola,\n\nSe creó un respaldo automático de la base de datos.\n\nRespaldos guardados: ${cantidadRespal}\n\nIMPORTANTE: el archivo NO se manda por correo, para que los datos de clientes y ventas no queden expuestos en tu bandeja de entrada.\n\nEntrá a ADAI POS → Respaldos y descargalo a un USB o a otra carpeta. Es el único respaldo que sobrevive si se daña esta computadora.\n\nEste correo es un aviso, no un respaldo.`
  })

  if (!prueba) {
    db.prepare('UPDATE configuracion_backup SET ultimo_aviso_en = ? WHERE id = 1')
      .run(new Date().toLocaleString('sv-SE').replace('T', ' '))
  }

  return { mensaje: 'Correo enviado', destinatarios }
}

// ─── PROGRAMACIÓN ──────────────────────────────────────────────────────────
const iniciarProgramacion = () => {
  if (intervalId) return

  const correr = async () => {
    try {
      const c = db.prepare('SELECT * FROM configuracion_backup WHERE id = 1').get()
      if (!c?.aviso_email_activo) return
      if (!c.email_remitente || !c.email_app_password || !c.email_destinatarios) return

      const ultimo = c.ultimo_aviso_en ? new Date(String(c.ultimo_aviso_en).replace(' ', 'T')) : null
      const dias    = ultimo ? (Date.now() - ultimo.getTime()) / 86400000 : Infinity

      if (dias >= (c.frecuencia_dias || 7)) {
        await crear({ automatico: true })
        const ret = aplicarRetencion()
        await enviarAviso()
        console.log(`💾 Respaldo automático creado y avisado (${ret.borrados} limpiados)`)
      }
    } catch (err) {
      console.error('⚠️  Error en respaldo programado:', err.message)
    }
  }

  // Cada hora
  intervalId = setInterval(correr, 60 * 60 * 1000)
  setTimeout(correr, 15000)
}

const detenerProgramacion = () => {
  if (intervalId) { clearInterval(intervalId); intervalId = null }
}

module.exports = {
  BACKUP_DIR, DB_PATH,
  crear, listar, obtener, eliminar, restaurar, resumen,
  aplicarRetencion, diasDesdeUltimo,
  obtenerConfig, guardarConfig, enviarAviso,
  iniciarProgramacion, detenerProgramacion
}
