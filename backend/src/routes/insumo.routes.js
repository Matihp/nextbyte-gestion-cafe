const { Router } = require('express');
const insumoController = require('../controllers/insumoController');
const { authRequired } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarInsumo, validarIngreso } = require('../dtos/insumo.dto');

const router = Router();

router.use(authRequired);

router.get('/', insumoController.obtenerTodos);
router.get('/alertas', insumoController.obtenerAlertas);
router.get('/:id', insumoController.obtenerPorId);
router.post('/', validate(validarInsumo), insumoController.crear);
router.put('/:id', validate(validarInsumo), insumoController.actualizar);
router.patch('/:id/ingreso', validate(validarIngreso), insumoController.ingresarStock);
router.delete('/:id', insumoController.eliminar);

module.exports = router;
