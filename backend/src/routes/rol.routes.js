const { Router } = require('express');
const rolController = require('../controllers/rolController');
const { authRequired, requireAdmin } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarRol } = require('../dtos/rol.dto');

const router = Router();

router.use(authRequired);

router.get('/', rolController.getAll);
router.get('/:id', rolController.getById);
router.post('/', requireAdmin, validate(validarRol), rolController.create);
router.put('/:id', requireAdmin, validate(validarRol), rolController.update);
router.delete('/:id', requireAdmin, rolController.remove);

module.exports = router;
