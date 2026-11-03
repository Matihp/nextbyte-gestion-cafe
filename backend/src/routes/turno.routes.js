const { Router } = require('express');
const turnoController = require('../controllers/turnoController');
const { authRequired } = require('../middlewares/authRequired');

const router = Router();

router.use(authRequired);

router.get('/', turnoController.listar);
router.put('/', turnoController.guardar);
router.delete('/:id', turnoController.eliminar);

module.exports = router;
