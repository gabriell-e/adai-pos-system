const service = require('../services/backup.service')
const fs      = require('fs')

// ─── ESTADO ────────────────────────────────────────────────────────────────
const estado = async (req, res) => {
  try {
    const respaldos = service.listar()
    const config     = service.obtenerConfig()

    const ultimo = respaldos[0]
    const automaticos = respaldos.filter(r => r.automatico)
    const diasDesdeUltimo = service.diasDesdeUltimo()

    res.json({
      directorio: service.BACKUP_DIR,
      total: respaldos.length,
      total_automaticos: automaticos.length,
      ultimo_respaldo: ultimo ? {
        archivo: ultimo.archivo,
        creado_en: ultimo.creado_en,
        tamano: ultimo.tamano
      } : null,
      dias_desde_ultimo: diasDesdeUltimo,
      config,
      // Aclaración importante para el usuario
      aviso: ultimo
        ? null
        : 'Todavía no hay ningún respaldo. Hacé uno ahora.'
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── LISTAR ────────────────────────────────────────────────────────────────
const listar = (req, res) => {
  try {
    res.json(service.listar())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CREAR RESPALDO AHORA ──────────────────────────────────────────────────
const crear = async (req, res) => {
  try {
    const r = await service.crear({ automatico: false })
    const ret = service.aplicarRetencion()
    res.status(201).json({
      ...r,
      mensaje: `Respaldo creado (${(r.tamano / 1024 / 1024).toFixed(2)} MB)`,
      limpiados: ret.borrados
    })
  } catch (err) {
    res.status(500).json({ error: `No se pudo crear el respaldo: ${err.message}` })
  }
}

// ─── DESCARGAR ─────────────────────────────────────────────────────────────
const descargar = (req, res) => {
  try {
    const r = service.obtener(req.params.archivo)
    if (!r || !r.ruta) return res.status(404).json({ error: 'Respaldo no encontrado' })

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${r.archivo}"`)
    fs.createReadStream(r.ruta).pipe(res)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── ELIMINAR ──────────────────────────────────────────────────────────────
const eliminar = (req, res) => {
  try {
    res.json(service.eliminar(req.params.archivo))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── RESUMEN (qué tiene este respaldo) ─────────────────────────────────────
// Se consulta antes de restaurar, para que el usuario vea si estácpyendo hacia
// atrás en el tiempo y cuántos datos hay. Restaurar es irreversible.
const resumen = (req, res) => {
  try {
    res.json(service.resumen(req.params.archivo))
  } catch (err) {
    res.status(500).json({ error: `No se pudo leer el respaldo: ${err.message}` })
  }
}

// ─── RESTAURAR ─────────────────────────────────────────────────────────────
const restaurar = async (req, res) => {
  try {
    const r = await service.restaurar(req.params.archivo)
    // La base fue reemplazada: hay que apagar el proceso.
    setTimeout(() => process.exit(0), 1500)
    res.json(r)
  } catch (err) {
    res.status(500).json({ error: `No se pudo restaurar: ${err.message}` })
  }
}

// ─── CONFIGURACIÓN DE EMAIL ────────────────────────────────────────────────
const obtenerConfig = (req, res) => {
  try {
    res.json(service.obtenerConfig())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const guardarConfig = (req, res) => {
  try {
    const { email_remitente, email_destinatarios } = req.body

    if (email_remitente && !/^\S+@\S+\.\S+$/.test(email_remitente)) {
      return res.status(400).json({ error: 'El email remitente no es válido' })
    }
    if (email_destinatarios) {
      const lista = String(email_destinatarios).split(',').map(s => s.trim()).filter(Boolean)
      const malos = lista.filter(e => !/^\S+@\S+\.\S+$/.test(e))
      if (malos.length) {
        return res.status(400).json({ error: `Email inválido: ${malos.join(', ')}` })
      }
    }

    const f = Number(req.body.frecuencia_dias)
    if (req.body.frecuencia_dias && (f < 1 || f > 90)) {
      return res.status(400).json({ error: 'La frecuencia debe estar entre 1 y 90 días' })
    }

    res.json(service.guardarConfig(req.body))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const probarConexion = async (req, res) => {
  try {
    const r = await service.enviarAviso({ prueba: true })
    res.json(r)
  } catch (err) {
    let mensaje = err.message
    if (/Invalid credentials|535|authentication/i.test(err.message)) {
      mensaje = 'Gmail rechazó las credenciales. Revisá el email y la contraseña de aplicación (son 16 caracteres, sin espacios).'
    } else if (/ECONNREFUSED|ETIMEDOUT|getaddrinfo/i.test(err.message)) {
      mensaje = 'No se pudo conectar a internet. Revisá la conexión de la computadora.'
    }
    res.status(400).json({ error: mensaje })
  }
}

module.exports = {
  estado, listar, crear, descargar, eliminar, restaurar, resumen,
  obtenerConfig, guardarConfig, probarConexion
}
