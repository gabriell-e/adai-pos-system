require('dotenv').config()

const express = require('express')
const path    = require('path')
const cors    = require('cors')
const { init } = require('./db')

const app = express()
const PORT = process.env.PORT

app.use(cors())
app.use(express.json())

// Inicializar BD
init()

// Rutas API
app.use('/api/usuarios',      require('./routes/usuarios.routes'))
app.use('/api/configuracion', require('./routes/configuracion.routes'))
app.use('/api/categorias',    require('./routes/categorias.routes'))
app.use('/api/productos',     require('./routes/productos.routes'))
app.use('/api/clientes',      require('./routes/clientes.routes'))
app.use('/api/proveedores',   require('./routes/proveedores.routes'))
app.use('/api/ventas',        require('./routes/ventas.routes'))
app.use('/api/compras', require('./routes/compras.routes'))
app.use('/api/caja', require('./routes/caja.routes'))
app.use('/api/consumo', require('./routes/consumo.routes'))

app.get('/api/ping', (req, res) => {
  res.json({ 
    mensaje: 'Adai POS funcionando ✅',
    hora_servidor: new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })
  })
})

// Servir frontend compilado
const distDir = path.join(__dirname, '..', 'client', 'dist')
app.use(express.static(distDir))
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🚀 Adai POS corriendo en http://localhost:${PORT}`)
  console.log(`🕐 Timezone: ${process.env.TZ}`)
})