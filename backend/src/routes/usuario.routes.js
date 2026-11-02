const { Router } = require('express');
const usuarioController = require('../controllers/usuarioController');
const { authRequired, requireAdmin } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarCambioRol, validarCambioPermisos } = require('../dtos/rol.dto');

const router = Router();

router.use(authRequired);

router.patch('/:id/rol', requireAdmin, validate(validarCambioRol), usuarioController.cambiarRol);
router.patch('/:id/permisos', requireAdmin, validate(validarCambioPermisos), usuarioController.cambiarPermisos);

module.exports = router;
