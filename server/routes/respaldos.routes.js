const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/respaldos.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

// Todo el módulo de respaldos es exclusivo del administrador
router.use(verificarToken, soloAdmin)

router.get('/',                       ctrl.estado)
router.get('/lista',                  ctrl.listar)
router.post('/',                      ctrl.crear)
router.get('/descargar/:archivo',     ctrl.descargar)
router.delete('/:archivo',            ctrl.eliminar)
router.get('/resumen/:archivo',      ctrl.resumen)
router.post('/restaurar/:archivo',    ctrl.restaurar)

router.get('/config',                 ctrl.obtenerConfig)
router.put('/config',                 ctrl.guardarConfig)
router.post('/config/probar',         ctrl.probarConexion)

module.exports = router
