const router = require('express').Router()
const ctrl = require('../controllers/categorias.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/',          ctrl.getAll)
router.get('/:id',       ctrl.getById)
router.post('/',     soloAdmin, ctrl.create)
router.put('/:id',   soloAdmin, ctrl.update)
router.delete('/:id', soloAdmin, ctrl.remove)

module.exports = router