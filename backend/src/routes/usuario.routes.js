const { Router } = require('express');
const usuarioController = require('../controllers/usuarioController');
const { authRequired, requireAdmin } = require('../middlewares/authRequired');
const AppError = require('../utils/AppError');
const validate = require('../middlewares/validate');
const { validarCambioRol, validarCambioPermisos } = require('../dtos/rol.dto');

const requireAdminOrSelf = (req, res, next) => {
  if (!req.user) {
    throw new AppError('No autenticado', 401, 'NO_AUTENTICADO');
  }
  if (req.user.es_admin || String(req.user.id) === String(req.params.id)) {
    return next();
  }
  throw new AppError('Acceso denegado: se requiere rol de administrador', 403, 'NO_AUTORIZADO');
};

const router = Router();

router.use(authRequired);

router.get('/', requireAdmin, usuarioController.getAll);
router.get('/:id', requireAdmin, usuarioController.getById);
router.post('/', requireAdmin, usuarioController.create);
router.put('/:id', requireAdminOrSelf, usuarioController.update);
router.delete('/:id', requireAdmin, usuarioController.remove);

router.patch('/:id/rol', requireAdmin, validate(validarCambioRol), usuarioController.cambiarRol);
router.patch('/:id/permisos', requireAdmin, validate(validarCambioPermisos), usuarioController.cambiarPermisos);

module.exports = router;
