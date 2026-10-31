const { Router } = require('express');
const proveedorController = require('../controllers/proveedorController');
const { authRequired } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarProveedor } = require('../dtos/proveedor.dto');

const router = Router();

router.use(authRequired);

router.get('/', proveedorController.obtenerTodos);
router.get('/:id', proveedorController.obtenerPorId);
router.post('/', validate(validarProveedor), proveedorController.crear);
router.put('/:id', validate(validarProveedor), proveedorController.actualizar);
router.delete('/:id', proveedorController.eliminar);

module.exports = router;
