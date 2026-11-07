/**
 * Servicio de Sincronización Offline/Online
 */
const {
  dbLocalDirect,
  dbCloudDirect,
  getActiveDb,
  hasPendingLocalSync,
  setPendingLocalSync,
  setLastSyncTime
} = require('../config/db');

const TABLAS_ORDEN = [
  'roles',
  'categorias',
  'proveedores',
  'insumos',
  'empleados',
  'turnos_empleados',
  'productos',
  'recetas',
  'ingredientes_recetas',
  'registros_mermas',
  'pedidos',
  'detalles_pedidos',
  'registro_ventas',
  'movimientos_caja'
];

const getLocalDb = () => dbLocalDirect || getActiveDb();

const registrarCambio = async (tabla, registroId, operacion = 'INSERT', datos = null, db = getLocalDb()) => {
  if (!db) return null;

  try {
    const tieneTabla = await db.schema.hasTable('sync_pendientes');
    if (!tieneTabla) return null;

    const payload = {
      tabla,
      registro_id: String(registroId),
      operacion,
      datos: datos ? JSON.stringify(datos) : null,
      estado: 'pendiente',
      intentos: 0,
      created_at: new Date().toISOString()
    };

    const [id] = await db('sync_pendientes').insert(payload);
    setPendingLocalSync(true);
    return id;
  } catch (error) {
    console.error(`⚠️ Error al registrar cambio offline en sync_pendientes (${tabla}:${registroId}):`, error.message);
    setPendingLocalSync(true);
    return null;
  }
};

const contarPendientes = async (db = getLocalDb()) => {
  if (!db) return 0;

  try {
    const tieneTabla = await db.schema.hasTable('sync_pendientes');
    if (!tieneTabla) return 0;

    const res = await db('sync_pendientes').where({ estado: 'pendiente' }).count('id as c').first();
    return Number(res?.c || 0);
  } catch {
    return 0;
  }
};

const hayPendientes = async (db = getLocalDb()) => {
  if (hasPendingLocalSync()) return true;
  const count = await contarPendientes(db);
  if (count > 0) {
    setPendingLocalSync(true);
    return true;
  }
  return false;
};

const obtenerPendientes = async (limite = 200, db = getLocalDb()) => {
  if (!db) return [];

  try {
    return await db('sync_pendientes')
      .where({ estado: 'pendiente' })
      .orderBy('id', 'asc')
      .limit(limite);
  } catch {
    return [];
  }
};

const marcarSincronizado = async (id, db = getLocalDb()) => {
  if (!db) return;

  try {
    await db('sync_pendientes')
      .where({ id })
      .update({
        estado: 'sincronizado',
        sincronizado_at: new Date().toISOString()
      });
  } catch (error) {
    console.error(`⚠️ Error al marcar registro ${id} como sincronizado:`, error.message);
  }
};

const marcarError = async (id, error, db = getLocalDb()) => {
  if (!db) return;

  try {
    const item = await db('sync_pendientes').where({ id }).first();
    const nuevosIntentos = (item?.intentos || 0) + 1;
    await db('sync_pendientes')
      .where({ id })
      .update({
        intentos: nuevosIntentos,
        ultimo_error: error ? error.message : 'Error desconocido',
        estado: nuevosIntentos >= 5 ? 'error' : 'pendiente'
      });
  } catch {}
};

const reconciliarTablas = async (dbOrigen = getLocalDb(), dbDestino = (dbCloudDirect || getLocalDb())) => {
  if (!dbOrigen || !dbDestino) {
    throw new Error('Las bases de datos origen y destino deben estar instanciadas');
  }

  const mapasId = {
    roles: new Map(),
    categorias: new Map(),
    proveedores: new Map(),
    insumos: new Map(),
    empleados: new Map(),
    productos: new Map(),
    recetas: new Map(),
    pedidos: new Map()
  };

  const resumen = {
    totalSincronizados: 0,
    detalles: {}
  };

  for (const tabla of TABLAS_ORDEN) {
    const tieneTablaOrigen = await dbOrigen.schema.hasTable(tabla);
    const tieneTablaDestino = await dbDestino.schema.hasTable(tabla);
    if (!tieneTablaOrigen || !tieneTablaDestino) continue;

    const registrosLocales = await dbOrigen(tabla).select('*');
    resumen.detalles[tabla] = { total: registrosLocales.length, sincronizados: 0, existentes: 0 };

    for (const reg of registrosLocales) {
      let existe = null;

      if (tabla === 'roles') {
        const porNombre = reg.nombre ? await dbDestino('roles').where({ nombre: reg.nombre }).first() : null;
        const porId = !porNombre ? await dbDestino('roles').where({ id: reg.id }).first() : null;
        existe = porNombre || porId;
        if (existe) {
          mapasId.roles.set(reg.id, existe.id);
          resumen.detalles[tabla].existentes++;
        }
      } else if (tabla === 'categorias') {
        const porNombre = reg.nombre ? await dbDestino('categorias').where({ nombre: reg.nombre }).first() : null;
        existe = porNombre;
        if (existe) {
          mapasId.categorias.set(reg.id, existe.id);
          resumen.detalles[tabla].existentes++;
        }
      } else if (tabla === 'proveedores') {
        const porCuit = reg.cuit ? await dbDestino('proveedores').where({ cuit: reg.cuit }).first() : null;
        const porNombre = !porCuit && reg.nombre ? await dbDestino('proveedores').where({ nombre: reg.nombre }).first() : null;
        existe = porCuit || porNombre;
        if (existe) {
          mapasId.proveedores.set(reg.id, existe.id);
          resumen.detalles[tabla].existentes++;
        }
      } else if (tabla === 'insumos') {
        const porNombre = reg.nombre ? await dbDestino('insumos').where({ nombre: reg.nombre }).first() : null;
        existe = porNombre;
        if (existe) {
          mapasId.insumos.set(reg.id, existe.id);
          const cambioStock = reg.cantidad_disponible !== undefined && reg.cantidad_disponible !== existe.cantidad_disponible;
          const cambioPrecio = reg.precio_costo !== undefined && Number(reg.precio_costo) !== Number(existe.precio_costo);
          if (cambioStock || cambioPrecio) {
            await dbDestino('insumos').where({ id: existe.id }).update({
              cantidad_disponible: reg.cantidad_disponible,
              precio_costo: reg.precio_costo,
              ultima_actualizacion: reg.ultima_actualizacion || new Date().toISOString()
            });
            resumen.detalles[tabla].sincronizados++;
            resumen.totalSincronizados++;
          } else {
            resumen.detalles[tabla].existentes++;
          }
        }
      } else if (tabla === 'empleados') {
        const porEmail = reg.email ? await dbDestino('empleados').where({ email: reg.email }).first() : null;
        const porNombre = !porEmail && reg.nombre ? await dbDestino('empleados').where({ nombre: reg.nombre }).first() : null;
        existe = porEmail || porNombre;
        if (existe) {
          mapasId.empleados.set(reg.id, existe.id);
          if (reg.activo !== undefined && reg.activo !== existe.activo) {
            await dbDestino('empleados').where({ id: existe.id }).update({ activo: reg.activo });
            resumen.detalles[tabla].sincronizados++;
            resumen.totalSincronizados++;
          } else {
            resumen.detalles[tabla].existentes++;
          }
        }
      } else if (tabla === 'turnos_empleados') {
        const empId = mapasId.empleados.get(reg.empleado_id) || reg.empleado_id;
        const porId = reg.id ? await dbDestino('turnos_empleados').where({ id: reg.id }).first() : null;
        const porDetalle = !porId
          ? await dbDestino('turnos_empleados').where({ empleado_id: empId, fecha: reg.fecha, hora_entrada: reg.hora_entrada }).first()
          : null;
        existe = porId || porDetalle;
        if (existe) {
          if (reg.hora_salida !== existe.hora_salida || reg.estado !== existe.estado) {
            await dbDestino('turnos_empleados').where({ id: existe.id }).update({
              hora_salida: reg.hora_salida,
              estado: reg.estado
            });
            resumen.detalles[tabla].sincronizados++;
            resumen.totalSincronizados++;
          } else {
            resumen.detalles[tabla].existentes++;
          }
        }
      } else if (tabla === 'productos') {
        const catId = mapasId.categorias.get(reg.categoria_id) || reg.categoria_id;
        const porNombre = reg.nombre ? await dbDestino('productos').where({ nombre: reg.nombre, categoria_id: catId }).first() : null;
        existe = porNombre;
        if (existe) {
          mapasId.productos.set(reg.id, existe.id);
          const cambioStock = reg.stock_actual !== undefined && reg.stock_actual !== existe.stock_actual;
          const cambioPrecio = reg.precio_venta !== undefined && Number(reg.precio_venta) !== Number(existe.precio_venta);
          if (cambioStock || cambioPrecio) {
            await dbDestino('productos').where({ id: existe.id }).update({
              stock_actual: reg.stock_actual,
              precio_venta: reg.precio_venta,
              updated_at: reg.updated_at || new Date().toISOString()
            });
            resumen.detalles[tabla].sincronizados++;
            resumen.totalSincronizados++;
          } else {
            resumen.detalles[tabla].existentes++;
          }
        }
      } else if (tabla === 'recetas') {
        const prodId = mapasId.productos.get(reg.producto_id) || reg.producto_id;
        const porProd = await dbDestino('recetas').where({ producto_id: prodId }).first();
        existe = porProd;
        if (existe) {
          mapasId.recetas.set(reg.id, existe.id);
          resumen.detalles[tabla].existentes++;
        }
      } else if (tabla === 'ingredientes_recetas') {
        const recId = mapasId.recetas.get(reg.receta_id) || reg.receta_id;
        const insId = mapasId.insumos.get(reg.insumo_id) || reg.insumo_id;
        const porPar = await dbDestino('ingredientes_recetas').where({ receta_id: recId, insumo_id: insId }).first();
        existe = porPar;
        if (existe) {
          if (reg.cantidad !== undefined && Number(reg.cantidad) !== Number(existe.cantidad)) {
            await dbDestino('ingredientes_recetas').where({ id: existe.id }).update({ cantidad: reg.cantidad });
            resumen.detalles[tabla].sincronizados++;
            resumen.totalSincronizados++;
          } else {
            resumen.detalles[tabla].existentes++;
          }
        }
      } else if (tabla === 'pedidos') {
        existe = await dbDestino('pedidos').where({ id: reg.id }).first();
        if (existe) {
          mapasId.pedidos.set(reg.id, existe.id);
          const cambioEstado = reg.estado && reg.estado !== existe.estado;
          const cambioTotal = reg.total !== undefined && Number(reg.total) !== Number(existe.total);
          const cambioPago = reg.metodo_pago && reg.metodo_pago !== existe.metodo_pago;
          if (cambioEstado || cambioTotal || cambioPago) {
            await dbDestino('pedidos').where({ id: existe.id }).update({
              estado: reg.estado,
              total: reg.total,
              metodo_pago: reg.metodo_pago,
              updated_at: reg.updated_at || new Date().toISOString()
            });
            resumen.detalles[tabla].sincronizados++;
            resumen.totalSincronizados++;
          } else {
            resumen.detalles[tabla].existentes++;
          }
        }
      } else if (tabla === 'detalles_pedidos') {
        const pedId = mapasId.pedidos.get(reg.pedido_id) || reg.pedido_id;
        const prodId = mapasId.productos.get(reg.producto_id) || reg.producto_id;
        const porId = reg.id ? await dbDestino('detalles_pedidos').where({ id: reg.id }).first() : null;
        const porPar = !porId ? await dbDestino('detalles_pedidos').where({ pedido_id: pedId, producto_id: prodId }).first() : null;
        existe = porId || porPar;
        if (existe) resumen.detalles[tabla].existentes++;
      } else if (tabla === 'registro_ventas') {
        const pedId = mapasId.pedidos.get(reg.pedido_id) || reg.pedido_id;
        const porId = reg.id ? await dbDestino('registro_ventas').where({ id: reg.id }).first() : null;
        const porPed = !porId && pedId ? await dbDestino('registro_ventas').where({ pedido_id: pedId }).first() : null;
        existe = porId || porPed;
        if (existe) resumen.detalles[tabla].existentes++;
      } else if (tabla === 'registros_mermas') {
        const prodId = mapasId.productos.get(reg.producto_id) || reg.producto_id;
        const porId = reg.id ? await dbDestino('registros_mermas').where({ id: reg.id }).first() : null;
        existe = porId;
        if (existe) resumen.detalles[tabla].existentes++;
      } else if (tabla === 'movimientos_caja') {
        existe = reg.id ? await dbDestino('movimientos_caja').where({ id: reg.id }).first() : null;
        if (existe) resumen.detalles[tabla].existentes++;
      } else {
        existe = reg.id ? await dbDestino(tabla).where({ id: reg.id }).first() : null;
        if (existe) resumen.detalles[tabla].existentes++;
      }

      if (!existe) {
        const payload = { ...reg };

        if (payload.rol_id && mapasId.roles.has(payload.rol_id)) {
          payload.rol_id = mapasId.roles.get(payload.rol_id);
        }
        if (payload.categoria_id && mapasId.categorias.has(payload.categoria_id)) {
          payload.categoria_id = mapasId.categorias.get(payload.categoria_id);
        }
        if (payload.producto_id && mapasId.productos.has(payload.producto_id)) {
          payload.producto_id = mapasId.productos.get(payload.producto_id);
        }
        if (payload.receta_id && mapasId.recetas.has(payload.receta_id)) {
          payload.receta_id = mapasId.recetas.get(payload.receta_id);
        }
        if (payload.insumo_id && mapasId.insumos.has(payload.insumo_id)) {
          payload.insumo_id = mapasId.insumos.get(payload.insumo_id);
        }
        if (payload.empleado_id && mapasId.empleados.has(payload.empleado_id)) {
          payload.empleado_id = mapasId.empleados.get(payload.empleado_id);
        }
        if (payload.usuario_id && mapasId.empleados.has(payload.usuario_id)) {
          payload.usuario_id = mapasId.empleados.get(payload.usuario_id);
        }
        if (payload.pedido_id && mapasId.pedidos.has(payload.pedido_id)) {
          payload.pedido_id = mapasId.pedidos.get(payload.pedido_id);
        }

        const insertRes = await dbDestino(tabla).insert(payload);
        const nuevoId = Array.isArray(insertRes) ? insertRes[0] : insertRes;

        resumen.detalles[tabla].sincronizados++;
        resumen.totalSincronizados++;

        const idDestino = nuevoId || reg.id;
        if (tabla === 'pedidos') mapasId.pedidos.set(reg.id, idDestino);
        if (tabla === 'productos') mapasId.productos.set(reg.id, idDestino);
        if (tabla === 'categorias') mapasId.categorias.set(reg.id, idDestino);
        if (tabla === 'roles') mapasId.roles.set(reg.id, idDestino);
        if (tabla === 'insumos') mapasId.insumos.set(reg.id, idDestino);
        if (tabla === 'empleados') mapasId.empleados.set(reg.id, idDestino);
        if (tabla === 'recetas') mapasId.recetas.set(reg.id, idDestino);
        if (tabla === 'proveedores') mapasId.proveedores.set(reg.id, idDestino);
      }

      try {
        const tieneSync = await dbOrigen.schema.hasTable('sync_pendientes');
        if (tieneSync) {
          const pendientes = await dbOrigen('sync_pendientes')
            .where({ tabla, registro_id: String(reg.id), estado: 'pendiente' });
          for (const p of pendientes) {
            await marcarSincronizado(p.id, dbOrigen);
            if (existe) {
              resumen.detalles[tabla].sincronizados++;
              resumen.totalSincronizados++;
              if (resumen.detalles[tabla].existentes > 0) {
                resumen.detalles[tabla].existentes--;
              }
            }
          }
        }
      } catch {}
    }
  }

  try {
    const tieneSync = await dbOrigen.schema.hasTable('sync_pendientes');
    if (tieneSync) {
      const pendientesRestantes = await obtenerPendientes(200, dbOrigen);
      for (const p of pendientesRestantes) {
        try {
          const existeEnDestino = await dbDestino(p.tabla).where({ id: p.registro_id }).first();
          if (existeEnDestino) {
            await marcarSincronizado(p.id, dbOrigen);
          } else {
            const existeEnOrigen = await dbOrigen(p.tabla).where({ id: p.registro_id }).first();
            if (!existeEnOrigen) {
              await dbOrigen('sync_pendientes').where({ id: p.id }).del();
            }
          }
        } catch {}
      }
    }
  } catch {}

  const pendientesFinales = await contarPendientes(dbOrigen);
  if (pendientesFinales === 0) {
    setPendingLocalSync(false);
  }

  setLastSyncTime(new Date().toISOString());
  return resumen;
};

module.exports = {
  TABLAS_ORDEN,
  registrarCambio,
  contarPendientes,
  hayPendientes,
  obtenerPendientes,
  marcarSincronizado,
  marcarError,
  reconciliarTablas
};
