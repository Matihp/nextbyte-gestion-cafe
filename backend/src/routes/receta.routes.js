const { Router } = require('express');
const recetaController = require('../controllers/recetaController');
const validate = require('../middlewares/validate');
const { validarReceta } = require('../dtos/receta.dto');

const router = Router();

router.get('/', recetaController.getAll);
router.get('/:id', recetaController.getById);
router.post('/', validate(validarReceta), recetaController.create);
router.put('/:id', validate(validarReceta), recetaController.update);
router.delete('/:id', recetaController.delete);

module.exports = router;
