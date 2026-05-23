const router = require('express').Router()
const ctrl = require('../controllers/compras.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken, soloAdmin)

router.get('/',              ctrl.getAll)
router.get('/:id',           ctrl.getById)
router.post('/',             ctrl.crear)
router.patch('/:id/anular',  ctrl.anular)

module.exports = router