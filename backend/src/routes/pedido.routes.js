const { Router } = require('express');
const pedidoController = require('../controllers/pedidoController');
const { authRequired } = require('../middlewares/authRequired');

const router = Router();

router.use(authRequired);

router.get('/', pedidoController.getAll);
router.get('/:id', pedidoController.getById);
router.post('/', pedidoController.create);
router.patch('/:id/cancelar', pedidoController.cancelar);
router.delete('/:id/items/:detalleId', pedidoController.eliminarItem);

module.exports = router;
