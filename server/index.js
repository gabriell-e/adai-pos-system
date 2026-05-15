require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { init } = require('./db')

const app = express()
const PORT = process.env.PORT

app.use(cors())
app.use(express.json())

// Inicializar BD
init()

// Rutas
app.use('/api/usuarios',      require('./routes/usuarios.routes'))
app.use('/api/configuracion', require('./routes/configuracion.routes'))
app.use('/api/categorias',    require('./routes/categorias.routes'))
//"Cualquier petición que empiece con /api/categorias (como GET, POST, DELETE), mándala al archivo de rutas de categorías"
app.use('/api/productos',     require('./routes/productos.routes'))
app.use('/api/clientes',      require('./routes/clientes.routes'))
app.use('/api/proveedores',   require('./routes/proveedores.routes'))
app.use('/api/ventas',        require('./routes/ventas.routes'))
app.use('/api/compras', require('./routes/compras.routes'))

app.get('/api/ping', (req, res) => {
  res.json({ 
    mensaje: 'Adai POS funcionando ✅',
    hora_servidor: new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server corriendo en http://localhost:${PORT}`)
  console.log(`🕐 Timezone: ${process.env.TZ}`)
})