const router = require('express').Router()
const ctrl = require('../controllers/configuracion.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken, soloAdmin)

router.get('/',  ctrl.get)
router.post('/', ctrl.upsert)

module.exports = router