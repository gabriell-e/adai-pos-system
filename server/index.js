const express = require('express')
const cors = require('cors')
const { init } = require('./db')

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

// Inicializar BD
init()

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: 'Adai POS funcionando ✅' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server corriendo en http://localhost:${PORT}`)
})