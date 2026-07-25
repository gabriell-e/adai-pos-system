const router = require('express').Router()
const ctrl = require('../controllers/ventas.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/',                  ctrl.getAll)
router.get('/hoy',               ctrl.getResumenHoy)
router.get('/:id',               ctrl.getById)
router.post('/',                 ctrl.crear)
router.patch('/:id/cobrar', soloAdmin, ctrl.cobrar)
router.patch('/:id/anular', soloAdmin, ctrl.anular)

module.exports = router