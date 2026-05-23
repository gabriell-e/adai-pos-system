const router = require('express').Router()
const ctrl = require('../controllers/productos.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/',                        ctrl.getAll)
router.get('/low-stock',               ctrl.getLowStock)
router.get('/barcode/:codigo',         ctrl.getByCodigoBarras)
router.get('/:id',                     ctrl.getById)
router.get('/inventario/valor',        ctrl.getValorInventario)
router.post('/',             soloAdmin, ctrl.create)
router.put('/:id',          soloAdmin, ctrl.update)
router.delete('/:id',       soloAdmin, ctrl.remove)
router.patch('/:id/activar', soloAdmin, ctrl.activar)

module.exports = router