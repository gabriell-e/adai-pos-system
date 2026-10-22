const { db } = require('../db')
const { ahora } = require('../utils/fecha')

// Deuda pendiente de un cliente.
//
// Son dos cosas distintas y hay que sumarlas:
//   1. Ventas totalmente fiadas (tipo_pago = 'fiado'): debe todo el total.
//   2. Ventas mixtas con una parte fiada: solo lo que quedo en el reparto como
//      'fiado'. El resto del pago_detalle ya se cobro y no es deuda.
//
// La consulta anterior solo miraba condicion_venta = 'credito', asi que las
// ventas mixtas no contaban y la deuda de esos clientes aparecia en 0. Ademas
// contaba las ventas anuladas, que ya no son deuda de nadie.
//
// El fiado de las mixtas sale de pago_detalle, que es texto JSON. Se usa
// json_extract sobre el valor de cada elemento: el CAST a REAL de j.value
// daria 0 porque ahi va el objeto entero serializado, no el numero.
const DEUDA_CLIENTE = `
  COALESCE((
    SELECT SUM(v.total) FROM ventas v
    WHERE v.cliente_id = c.id
      AND v.tipo_pago = 'fiado'
      AND v.fiado_pagada = 0
      AND v.estado = 'completada'
  ), 0) + COALESCE((
    SELECT SUM(json_extract(j.value, '$.monto'))
    FROM ventas v, json_each(v.pago_detalle) j
    WHERE v.cliente_id = c.id
      AND v.tipo_pago = 'mixto'
      AND v.fiado_pagada = 0
      AND v.estado = 'completada'
      AND v.pago_detalle IS NOT NULL
      AND json_extract(j.value, '$.tipo') = 'fiado'
  ), 0)
`

const getAll = (req, res) => {
  try {
    const clientes = db.prepare(`
      SELECT c.*,
        ${DEUDA_CLIENTE} AS deuda_total
      FROM clientes c
      ORDER BY c.nombre
    `).all()
    res.json(clientes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getById = (req, res) => {
  try {
    const cliente = db.prepare(`
      SELECT c.*, ${DEUDA_CLIENTE} AS deuda_total
      FROM clientes c
      WHERE c.id = ?
    `).get(req.params.id)
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(cliente)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getHistorial = (req, res) => {
  try {
    // Incluye las ventas mixtas que quedaron con saldo fiado, que antes no
    // aparecian porque solo se buscaban las de condicion_venta = 'credito'.
    const ventas = db.prepare(`
      SELECT v.id, v.numero_factura, v.total, v.tipo_pago,
             v.condicion_venta, v.estado, v.fiado_pagada, v.creado_en,
             v.pago_detalle,
             CASE
               WHEN v.tipo_pago = 'fiado' AND v.fiado_pagada = 0 AND v.estado = 'completada'
                 THEN v.total
               WHEN v.tipo_pago = 'mixto' AND v.fiado_pagada = 0 AND v.estado = 'completada'
                 THEN COALESCE((
                   SELECT SUM(json_extract(j.value, '$.monto'))
                   FROM json_each(v.pago_detalle) j
                   WHERE json_extract(j.value, '$.tipo') = 'fiado'
                 ), 0)
               ELSE 0
             END AS monto_fiado
      FROM ventas v
      WHERE v.cliente_id = ?
        AND (
          (v.tipo_pago = 'fiado' AND v.fiado_pagada = 0)
          OR (
            v.tipo_pago = 'mixto' AND v.fiado_pagada = 0
            AND v.pago_detalle IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM json_each(v.pago_detalle) j
              WHERE json_extract(j.value, '$.tipo') = 'fiado'
            )
          )
        )
      ORDER BY v.creado_en DESC
    `).all(req.params.id)
    res.json(ventas)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const { nombre, ruc_ci, telefono, email } = req.body
    if (!nombre?.trim())       return res.status(400).json({ error: 'El nombre es obligatorio' })
    if (nombre.length > 100)   return res.status(400).json({ error: 'Nombre demasiado largo' })
    if (telefono?.length > 20) return res.status(400).json({ error: 'Teléfono inválido' })
    if (ruc_ci?.length > 20)   return res.status(400).json({ error: 'RUC/CI inválido' })
  try {
    const result = db.prepare(`
      INSERT INTO clientes (nombre, ruc_ci, telefono, email, creado_en)
      VALUES (?, ?, ?, ?, ?)
    `).run(nombre.trim(), ruc_ci || null, telefono || null, email || null, ahora())
    res.status(201).json({ id: result.lastInsertRowid, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const { nombre, ruc_ci, telefono, email } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })

  try {
    const result = db.prepare(`
      UPDATE clientes SET nombre = ?, ruc_ci = ?, telefono = ?, email = ?
      WHERE id = ?
    `).run(nombre.trim(), ruc_ci || null, telefono || null, email || null, req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json({ id: Number(req.params.id), ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const remove = (req, res) => {
  try {
    const ventas = db.prepare('SELECT COUNT(*) as total FROM ventas WHERE cliente_id = ?').get(req.params.id)
    if (ventas.total > 0) {
      return res.status(409).json({ error: 'No se puede eliminar, tiene ventas asociadas' })
    }
    const result = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json({ mensaje: 'Cliente eliminado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getHistorial, create, update, remove }