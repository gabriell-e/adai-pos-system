const router = require('express').Router({ mergeParams: true })
const ctrl = require('../controllers/presentaciones.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/',                        ctrl.getAllByProduct)
router.post('/',             soloAdmin, ctrl.create)
router.put('/:id',          soloAdmin, ctrl.update)
router.delete('/:id',       soloAdmin, ctrl.remove)

module.exports = router
