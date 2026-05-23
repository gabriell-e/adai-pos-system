const router = require('express').Router()
const ctrl = require('../controllers/proveedores.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/',               ctrl.getAll)
router.get('/:id',            ctrl.getById)
router.get('/:id/historial',  ctrl.getHistorial)
router.post('/',    soloAdmin, ctrl.create)
router.put('/:id',  soloAdmin, ctrl.update)
router.delete('/:id',       soloAdmin, ctrl.remove)
router.patch('/:id/activar', soloAdmin, ctrl.activar)

module.exports = router