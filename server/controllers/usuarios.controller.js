const { db } = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'adai_secret_dev'

// ─── LOGIN ───────────────────────────────────────────────────────────────────
const login = (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' })

  try {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email)
    if (!usuario)
      return res.status(401).json({ error: 'Credenciales incorrectas' })

    const valido = bcrypt.compareSync(password, usuario.password_hash)
    if (!valido)
      return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    )

    res.json({
      token,
      usuario: {
        id:     usuario.id,
        nombre: usuario.nombre,
        email:  usuario.email,
        rol:    usuario.rol
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── GET ALL ─────────────────────────────────────────────────────────────────
const getAll = (req, res) => {
  try {
    const usuarios = db.prepare(
      'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre'
    ).all()
    res.json(usuarios)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── GET BY ID ───────────────────────────────────────────────────────────────
const getById = (req, res) => {
  try {
    const usuario = db.prepare(
      'SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE id = ?'
    ).get(req.params.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json(usuario)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────
const create = (req, res) => {
  const { nombre, email, password, rol } = req.body
  if (!nombre)   return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!email)    return res.status(400).json({ error: 'El email es obligatorio' })
  if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria' })
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  try {
    const password_hash = bcrypt.hashSync(password, 10)
    const result = db.prepare(`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES (?, ?, ?, ?)
    `).run(nombre.trim(), email.trim(), password_hash, rol || 'cajero')

    res.status(201).json({
      id:     result.lastInsertRowid,
      nombre: nombre.trim(),
      email:  email.trim(),
      rol:    rol || 'cajero'
    })
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    res.status(500).json({ error: err.message })
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
const update = (req, res) => {
  const { nombre, email, rol } = req.body
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!email)  return res.status(400).json({ error: 'El email es obligatorio' })

  try {
    const result = db.prepare(`
      UPDATE usuarios SET nombre = ?, email = ?, rol = ? WHERE id = ?
    `).run(nombre.trim(), email.trim(), rol || 'cajero', req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ id: Number(req.params.id), nombre, email, rol })
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
    res.status(500).json({ error: err.message })
  }
}

// ─── CAMBIAR CONTRASEÑA ──────────────────────────────────────────────────────
const changePassword = (req, res) => {
  const { password_actual, password_nuevo } = req.body
  if (!password_actual || !password_nuevo)
    return res.status(400).json({ error: 'Ambas contraseñas son obligatorias' })
  if (password_nuevo.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })

  try {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' })

    const valido = bcrypt.compareSync(password_actual, usuario.password_hash)
    if (!valido) return res.status(401).json({ error: 'Contraseña actual incorrecta' })

    const password_hash = bcrypt.hashSync(password_nuevo, 10)
    db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
      .run(password_hash, req.params.id)

    res.json({ mensaje: 'Contraseña actualizada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ─── DESACTIVAR ──────────────────────────────────────────────────────────────
const remove = (req, res) => {
  try {
    const result = db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ mensaje: 'Usuario desactivado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { login, getAll, getById, create, update, changePassword, remove }