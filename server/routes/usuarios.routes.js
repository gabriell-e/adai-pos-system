const router = require('express').Router()
const ctrl = require('../controllers/usuarios.controller')
const { verificarToken, soloAdmin } = require('../middlewares/auth.middleware')

// Pública
router.post('/login', ctrl.login)

// Protegidas
router.get('/',                              verificarToken, soloAdmin, ctrl.getAll)
router.get('/:id',                           verificarToken, ctrl.getById)
router.post('/',                             verificarToken, soloAdmin, ctrl.create)
router.put('/:id',                           verificarToken, soloAdmin, ctrl.update)
router.patch('/:id/password',                verificarToken, ctrl.changePassword)
router.delete('/:id',                        verificarToken, soloAdmin, ctrl.remove)

module.exports = router