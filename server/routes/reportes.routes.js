const router = require('express').Router()
const ctrl = require('../controllers/reportes.controller')
const { verificarToken } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/inventario',       ctrl.inventario)
router.get('/inventario/excel', ctrl.inventarioExcel)
router.get('/ventas',           ctrl.ventas)
router.get('/ventas/excel',     ctrl.ventasExcel)
router.get('/graficas',         ctrl.graficas)

module.exports = router
