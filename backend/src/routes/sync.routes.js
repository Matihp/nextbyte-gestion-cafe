const { Router } = require('express');
const { getStatus, ejecutarSync } = require('../controllers/syncController');
const { authRequired } = require('../middlewares/authRequired');

const router = Router();

router.get('/status', getStatus);
router.post('/ejecutar', authRequired, ejecutarSync);

module.exports = router;
