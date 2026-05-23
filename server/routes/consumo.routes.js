const router = require('express').Router()
const ctrl   = require('../controllers/consumo.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken, soloAdmin)

router.get('/',              ctrl.getAll)
router.post('/',             ctrl.crear)
router.delete('/:id/anular', ctrl.anular)

module.exports = router