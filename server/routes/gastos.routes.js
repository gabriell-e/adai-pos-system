const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/gastos.controller')
const { verificarToken } = require('../middlewares/auth.middleware')

router.get('/',             verificarToken, ctrl.getAll)
router.get('/resumen',      verificarToken, ctrl.getResumen)
router.post('/',            verificarToken, ctrl.crear)
router.patch('/:id/anular', verificarToken, ctrl.anular)

module.exports = router
