const { Router } = require('express');

const router = Router();
const reporteController = require('../controllers/reporteController');

router.get('/estadisticas', reporteController.obtenerEstadisticas);

module.exports = router;
