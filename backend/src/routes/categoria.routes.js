const { Router } = require('express');
const categoriaController = require('../controllers/categoriaController');
const { authRequired } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarCategoria } = require('../dtos/categoria.dto');

const router = Router();

router.use(authRequired);

router.get('/', categoriaController.getAll);
router.get('/:id', categoriaController.getById);
router.post('/', validate(validarCategoria), categoriaController.create);
router.put('/:id', validate(validarCategoria), categoriaController.update);
router.delete('/:id', categoriaController.delete);

module.exports = router;
