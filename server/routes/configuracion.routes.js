const router = require('express').Router()
const ctrl = require('../controllers/configuracion.controller')

router.get('/',  ctrl.get)
router.post('/', ctrl.upsert)

module.exports = router