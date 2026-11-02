const { Router } = require('express');
const productoController = require('../controllers/productoController');
const { authRequired } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarProducto } = require('../dtos/producto.dto');

const router = Router();

router.use(authRequired);

router.get('/', productoController.getAll);
router.get('/:id', productoController.getById);
router.post('/', validate(validarProducto), productoController.create);
router.put('/:id', validate(validarProducto), productoController.update);
router.delete('/:id', productoController.delete);

module.exports = router;
