const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'adai_secret_dev'

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer <token>

  if (!token)
    return res.status(401).json({ error: 'Token requerido' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.usuario = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' })
  }
}

const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'admin')
    return res.status(403).json({ error: 'Solo administradores' })
  next()
}

module.exports = { verificarToken, soloAdmin }