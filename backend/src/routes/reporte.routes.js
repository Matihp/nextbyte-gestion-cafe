const { Router } = require('express');
const { authRequired } = require('../middlewares/authRequired');
const reporteController = require('../controllers/reporteController');

const router = Router();

router.use(authRequired);

router.get('/ventas-dia', reporteController.obtenerVentasDia);
router.get('/ventas-rango', reporteController.obtenerVentasRango);
router.get('/top-productos', reporteController.obtenerTopProductos);
router.get('/ganancias', reporteController.obtenerGanancias);
router.get('/mermas', reporteController.obtenerMermas);
router.get('/resumen', reporteController.obtenerResumen);

module.exports = router;
