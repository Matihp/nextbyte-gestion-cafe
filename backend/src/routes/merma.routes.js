const { Router } = require('express');
const mermaController = require('../controllers/mermaController');
const { authRequired } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarMerma } = require('../dtos/merma.dto');

const router = Router();

router.use(authRequired);

router.get('/', mermaController.obtenerTodas);
router.post('/', validate(validarMerma), mermaController.crear);
router.delete('/:id', mermaController.eliminar);

module.exports = router;
