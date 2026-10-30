const { Router } = require('express');

const router = Router();

// Cada módulo tiene su archivo <nombre>.routes.js. Acá se registran TODOS,
// así nadie más tiene que editar este archivo.
router.use('/auth', require('./auth.routes'));
router.use('/usuarios', require('./usuario.routes'));
router.use('/roles', require('./rol.routes'));
router.use('/empleados', require('./empleado.routes'));
router.use('/turnos', require('./turno.routes'));
router.use('/pedidos', require('./pedido.routes'));
router.use('/categorias', require('./categoria.routes'));
router.use('/productos', require('./producto.routes'));
router.use('/comandas', require('./comanda.routes'));
router.use('/proveedores', require('./proveedor.routes'));
router.use('/insumos', require('./insumo.routes'));
router.use('/mermas', require('./merma.routes'));
router.use('/reportes', require('./reporte.routes'));

module.exports = router;
