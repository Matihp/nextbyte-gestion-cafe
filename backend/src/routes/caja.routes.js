const { Router } = require('express');
const { authRequired } = require('../middlewares/authRequired');
const cajaController = require('../controllers/cajaController');

const router = Router();

router.use(authRequired);

router.get('/movimientos', cajaController.listarMovimientos);
router.post('/movimientos', cajaController.crearMovimiento);
router.delete('/movimientos/:id', cajaController.eliminarMovimiento);
router.get('/saldo-anterior', cajaController.getSaldoAnterior);
router.get('/mermas-mes', cajaController.getMermasMes);

module.exports = router;

