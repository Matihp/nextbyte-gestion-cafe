const { Router } = require('express');
const comandaController = require('../controllers/comandaController');
const { authRequired } = require('../middlewares/authRequired');

const router = Router();

router.use(authRequired);

router.get('/activas', comandaController.obtenerActivas);
router.patch('/:id/estado', comandaController.cambiarEstado);

module.exports = router;
