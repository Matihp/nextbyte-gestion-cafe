const { Router } = require('express');
const empleadoController = require('../controllers/empleadoController');
const { authRequired, requireAdmin, requirePermiso } = require('../middlewares/authRequired');

const router = Router();

router.use(authRequired);

const verificarPermisoEdicion = (req, res, next) => {
  if (req.body.contrasena || req.body.email) {
    return requireAdmin(req, res, next);
  }
  return requirePermiso('empleados')(req, res, next);
};

router.get('/', empleadoController.getAll);
router.get('/:id', empleadoController.getById);
router.post('/', requireAdmin, empleadoController.create);
router.put('/:id', verificarPermisoEdicion, empleadoController.update);
router.delete('/:id', requireAdmin, empleadoController.remove);

module.exports = router;
