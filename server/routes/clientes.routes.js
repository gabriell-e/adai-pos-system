const router = require('express').Router()
const ctrl = require('../controllers/clientes.controller')

router.get('/',              ctrl.getAll)
router.get('/:id',           ctrl.getById)
router.get('/:id/historial', ctrl.getHistorial)
router.post('/',             ctrl.create)
router.put('/:id',           ctrl.update)
router.delete('/:id',        ctrl.remove)

module.exports = router