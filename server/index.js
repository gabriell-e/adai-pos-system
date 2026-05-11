const express = require('express')
const cors = require('cors')
const { init } = require('./db')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Inicializar BD
init()

// Rutas
app.use('/api/configuracion', require('./routes/configuracion.routes'))
app.use('/api/categorias',    require('./routes/categorias.routes'))
//"Cualquier petición que empiece con /api/categorias (como GET, POST, DELETE), mándala al archivo de rutas de categorías"
app.use('/api/productos',     require('./routes/productos.routes'))
app.use('/api/clientes',      require('./routes/clientes.routes'))
app.use('/api/proveedores',   require('./routes/proveedores.routes'))
app.use('/api/ventas',        require('./routes/ventas.routes'))

app.get('/api/ping', (req, res) => {
  res.json({ mensaje: 'Adai POS funcionando ✅' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server corriendo en http://localhost:${PORT}`)
})