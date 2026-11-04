const { Router } = require('express');
const usuarioController = require('../controllers/usuarioController');
const { authRequired, requireAdmin } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarCambioRol, validarCambioPermisos } = require('../dtos/rol.dto');

const router = Router();

router.use(authRequired);

router.get('/', requireAdmin, usuarioController.getAll);
router.get('/:id', requireAdmin, usuarioController.getById);
router.post('/', requireAdmin, usuarioController.create);
router.put('/:id', requireAdmin, usuarioController.update);
router.delete('/:id', requireAdmin, usuarioController.remove);

router.patch('/:id/rol', requireAdmin, validate(validarCambioRol), usuarioController.cambiarRol);
router.patch('/:id/permisos', requireAdmin, validate(validarCambioPermisos), usuarioController.cambiarPermisos);

module.exports = router;
