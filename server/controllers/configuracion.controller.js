const { db } = require('../db')

const get = (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM configuracion ORDER BY id DESC LIMIT 1').get()
    if (!config) return res.status(404).json({ error: 'Sin configuración' })
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const upsert = (req, res) => {
  const {
    razon_social, ruc, direccion, telefono,
    timbrado, timbrado_inicio, timbrado_vencimiento,
    factura_desde, punto_expedicion, establecimiento
  } = req.body

  if (!razon_social) return res.status(400).json({ error: 'La razón social es obligatoria' })
  if (!ruc)          return res.status(400).json({ error: 'El RUC es obligatorio' })
  if (!timbrado)     return res.status(400).json({ error: 'El timbrado es obligatorio' })
  if (!timbrado_inicio) return res.status(400).json({ error: 'La fecha de inicio del timbrado es obligatoria' })

  try {
    const existe = db.prepare('SELECT id FROM configuracion LIMIT 1').get()

    if (existe) {
      db.prepare(`
        UPDATE configuracion SET
          razon_social = ?, ruc = ?, direccion = ?, telefono = ?,
          timbrado = ?, timbrado_inicio = ?, timbrado_vencimiento = ?,
          punto_expedicion = ?, establecimiento = ?
        WHERE id = ?
      `).run(
        razon_social, ruc, direccion || null, telefono || null,
        timbrado, timbrado_inicio, timbrado_vencimiento || null,
        punto_expedicion || '001', establecimiento || '001',
        existe.id
      )
      res.json({ mensaje: 'Configuración actualizada' })
    } else {
      const result = db.prepare(`
        INSERT INTO configuracion (
          razon_social, ruc, direccion, telefono,
          timbrado, timbrado_inicio, timbrado_vencimiento,
          factura_desde, punto_expedicion, establecimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        razon_social, ruc, direccion || null, telefono || null,
        timbrado, timbrado_inicio, timbrado_vencimiento || null,
        factura_desde || 1, punto_expedicion || '001', establecimiento || '001'
      )
      res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Configuración creada' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { get, upsert }