const router = require('express').Router()
const ctrl = require('../controllers/productos.controller')

router.get('/',                        ctrl.getAll)
router.get('/low-stock',               ctrl.getLowStock)
router.get('/barcode/:codigo',         ctrl.getByCodigoBarras)
router.get('/:id',                     ctrl.getById)
router.post('/',                       ctrl.create)
router.put('/:id',                     ctrl.update)
router.delete('/:id',                  ctrl.remove)

module.exports = router