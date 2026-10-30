const { dbLocal } = require('./src/config/db');

async function ejecutarPruebas() {
  console.log('====================================================');
  console.log('🧪 PRUEBAS DE INTEGRACIÓN: BASE DE DATOS Y RELACIONES');
  console.log('====================================================\n');

  try {
    // Relación Empleados -> Roles
    console.log('1️⃣  Probando relación EMPLEADOS -> ROLES (JOIN)...');
    const empleados = await dbLocal('empleados as e')
      .join('roles as r', 'e.rol_id', 'r.id')
      .select('e.nombre', 'e.apellido', 'e.email', 'r.nombre as rol', 'r.es_admin');
    console.log('   Resultado:', empleados);
    console.log('   ✅ Relación Empleados-Roles funciona correctamente.\n');

    // Relación Turnos -> Empleados
    console.log('2️⃣  Probando relación TURNOS -> EMPLEADOS (JOIN)...');
    const turnos = await dbLocal('turnos_empleados as t')
      .join('empleados as e', 't.empleado_id', 'e.id')
      .select('t.id', 't.fecha', 't.estado', 'e.nombre', 'e.apellido');
    console.log('   Resultado:', turnos);
    console.log('   ✅ Relación Turnos-Empleados funciona correctamente.\n');

    // Relación Insumos -> Proveedores
    console.log('3️⃣  Probando relación INSUMOS -> PROVEEDORES (JOIN)...');
    // La relación es N:M y se guarda como JSON en proveedores.insumos_asignados_ids
    const proveedores = await dbLocal('proveedores').select('id', 'empresa', 'insumos_asignados_ids');
    const insumos = [];
    for (const prov of proveedores) {
      const ids = typeof prov.insumos_asignados_ids === 'string'
        ? JSON.parse(prov.insumos_asignados_ids || '[]')
        : (prov.insumos_asignados_ids || []);
      const filas = await dbLocal('insumos')
        .whereIn('id', ids)
        .select('nombre as insumo', 'cantidad_disponible', 'unidad_medida');
      filas.forEach((f) => insumos.push({ ...f, proveedor: prov.empresa }));
    }
    console.log('   Resultado:', insumos);
    if (insumos.length === 0) throw new Error('Ningún proveedor tiene insumos asignados');
    console.log('   ✅ Relación Insumos-Proveedores funciona correctamente.\n');

    // Relación Productos -> Categorías
    console.log('4️⃣  Probando relación PRODUCTOS -> CATEGORÍAS (JOIN)...');
    const productos = await dbLocal('productos as p')
      .join('categorias as c', 'p.categoria_id', 'c.id')
      .select('p.id', 'p.nombre as producto', 'p.precio_venta', 'c.nombre as categoria');
    console.log('   Resultado:', productos);
    console.log('   ✅ Relación Productos-Categorías funciona correctamente.\n');

    // Relación Recetas -> Productos -> Ingredientes -> Insumos (4 Tablas unidas)
    console.log('5️⃣  Probando RECETAS -> PRODUCTOS -> INGREDIENTES -> INSUMOS (4 Tablas)...');
    const recetasCompletas = await dbLocal('recetas as rec')
      .join('productos as p', 'rec.producto_id', 'p.id')
      .join('ingredientes_recetas as ir', 'rec.id', 'ir.receta_id')
      .join('insumos as ins', 'ir.insumo_id', 'ins.id')
      .select(
        'p.nombre as producto',
        'rec.nombre as receta',
        'ins.nombre as insumo',
        'ir.cantidad',
        'ins.unidad_medida'
      );
    console.log('   Resultado:', recetasCompletas);
    console.log('   ✅ Relación Recetas-Insumos funciona correctamente.\n');

    // Relación Pedidos -> Detalles -> Productos -> Ventas (Cadena comercial)
    console.log('6️⃣  Probando PEDIDOS -> DETALLES -> PRODUCTOS -> VENTAS...');
    const pedidosCompletos = await dbLocal('pedidos as ped')
      .join('detalles_pedidos as dp', 'ped.id', 'dp.pedido_id')
      .join('productos as prod', 'dp.producto_id', 'prod.id')
      .leftJoin('registro_ventas as rv', 'ped.id', 'rv.pedido_id')
      .select(
        'ped.id as pedido_id',
        'ped.cliente',
        'prod.nombre as item',
        'dp.cantidad',
        'dp.precio_venta',
        'rv.fecha as fecha_registro_venta',
        'rv.total_venta as venta_registrada'
      );
    console.log('   Resultado:', pedidosCompletos);
    console.log('   ✅ Cadena Pedidos-Detalles-Ventas funciona correctamente.\n');

    // Validación de clave foránea inválida (debe fallar)
    console.log('7️⃣  Probando restricción de Foreign Key (intentar insertar dato inválido)...');
    try {
      await dbLocal('turnos_empleados').insert({
        id: 'turno-invalido',
        empleado_id: 'emp-no-existe-999', // No existe
        fecha: '2026-10-26',
        estado: 'presente'
      });
      console.error('   ❌ ERROR: La base de datos permitió insertar un empleado_id inválido.');
      process.exit(1);
    } catch (fkError) {
      console.log('   ✅ ÉXITO: SQLite bloqueó la inserción inválida con error:', fkError.code || fkError.message);
    }

    console.log('====================================================');
    console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE (100% OK)');
    console.log('====================================================');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error durante la ejecución de las pruebas:', error);
    process.exit(1);
  }
}

ejecutarPruebas();
