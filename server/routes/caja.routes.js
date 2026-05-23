const router = require('express').Router()
const ctrl = require('../controllers/caja.controller')
const { verificarToken } = require('../middlewares/auth.middleware')

router.use(verificarToken)

router.get('/',             ctrl.getAll)
router.get('/activa',       ctrl.getActiva)
router.get('/:id',          ctrl.getById)
router.post('/abrir',       ctrl.abrir)
router.patch('/:id/cerrar', ctrl.cerrar)

module.exports = router