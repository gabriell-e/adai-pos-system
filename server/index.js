require('dotenv').config()

// Tiene que ir antes de cualquier require que toque la base:
// si ya hay otro servidor corriendo, se frena acá y no se daña nada.
require('./utils/instancia.unica')()

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
app.use('/api/productos/:productoId/presentaciones', require('./routes/presentaciones.routes'))
app.use('/api/clientes',      require('./routes/clientes.routes'))
app.use('/api/proveedores',   require('./routes/proveedores.routes'))
app.use('/api/ventas',        require('./routes/ventas.routes'))
app.use('/api/compras', require('./routes/compras.routes'))
app.use('/api/caja', require('./routes/caja.routes'))
app.use('/api/consumo', require('./routes/consumo.routes'))
app.use('/api/reportes',   require('./routes/reportes.routes'))
app.use('/api/respaldos',  require('./routes/respaldos.routes'))
app.use('/api/gastos',     require('./routes/gastos.routes'))

app.get('/api/ping', (req, res) => {
  res.json({ 
    mensaje: 'Adai POS funcionando ✅',
    hora_servidor: new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' })
  })
})

// Servir frontend compilado
//
// El index.html NUNCA se cachea: es el archivo que apunta a los bundles, y si
// el navegador guarda una copia vieja, sigue pidiendo los bundles anteriores.
// Como los nombres llevan un hash, esos archivos ya no existen y el navegador
// los saca de su propia caché: resultado, una interfaz vieja sin explicación.
//
// En cambio, los bundles y el CSS sí llevan hash en el nombre, así que si el
// nombre es nuevo el contenido es nuevo: se cachean para siempre.
const distDir = path.join(__dirname, '..', 'client', 'dist')

app.use(express.static(distDir, {
  index: false,
  setHeaders: (res, filePath) => {
    if (/[.-][0-9A-Za-z_-]{8,}\.(js|css|woff2?|svg|png|jpg|webp)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
  }
}))

// Cualquier ruta que no sea API devuelve el index.html (para que funcione el
// router del lado del cliente). Siempre sin caché, por lo mismo de arriba.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.sendFile(path.join(distDir, 'index.html'))
})

// Respaldos automáticos
const backupService = require('./services/backup.service')
backupService.iniciarProgramacion()

app.listen(PORT, () => {
  console.log(`🚀 Adai POS corriendo en http://localhost:${PORT}`)
  console.log(`🕐 Timezone: ${process.env.TZ}`)

  // Aviso de desarrollo: el 3001 no lee el código fuente, sirve client/dist.
  // Sin esto se prueba una versión vieja sin darse cuenta.
  if (process.env.NODE_ENV !== 'production') {
    console.log('')
    console.log('ℹ️  MODO DESARROLLO: este puerto sirve client/dist, no tu código fuente.')
    console.log('   Para ver los cambios del cliente:')
    console.log('     - abrí el 5173 (Vite, se actualiza solo), o')
    console.log('     - dejá "npm run build:watch" corriendo en client, o')
    console.log('     - corré "npm run build" en client antes de probar acá.')
    console.log('')
  }

  // Primer respaldo al arrancar, para que nunca exista un día sin red
  backupService.crear({ automatico: true })
    .then(r => {
      const ret = backupService.aplicarRetencion()
      console.log(`💾 Respaldo inicial creado: ${r.archivo} (${(r.tamano / 1024).toFixed(0)} KB)`)
      if (ret.borrados) console.log(`🗑️  ${ret.borrados} respaldos antiguos eliminados`)
    })
    .catch(err => console.error('⚠️  No se pudo crear el respaldo inicial:', err.message))
})