const crypto = require('crypto');
const { dbLocal } = require('../config/db');
const movimientoCajaRepository = require('../repositories/movimientoCajaRepository');
const productoRepository = require('../repositories/productoRepository');
const insumoRepository = require('../repositories/insumoRepository');
const AppError = require('../utils/AppError');
const { runBusinessMutation } = require('./mutationExecutor');

const TIPOS_VALIDOS = ['INGRESO', 'RETIRO'];

const validarDatos = (datos) => {
  const errores = [];

  if (!datos.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) {
    errores.push('fecha debe tener formato YYYY-MM-DD');
  }
  if (!datos.hora || !/^\d{2}:\d{2}(:\d{2})?$/.test(datos.hora)) {
    errores.push('hora debe tener formato HH:mm o HH:mm:ss');
  }
  if (!datos.tipo || !TIPOS_VALIDOS.includes(datos.tipo)) {
    errores.push(`tipo debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
  }
  if (!datos.detalle || !datos.detalle.trim()) {
    errores.push('detalle es obligatorio');
  }
  if (datos.monto === undefined || datos.monto === null || isNaN(Number(datos.monto)) || Number(datos.monto) <= 0) {
    errores.push('monto debe ser un número mayor a 0');
  }

  return errores;
};

const listarMovimientos = async (filtros = {}, opciones = {}) => {
  return movimientoCajaRepository.getAll(filtros, opciones.db || dbLocal);
};

const crearMovimiento = async (datos, usuarioIdOrOptions = null, maybeOptions = {}) => {
  let usuarioId = usuarioIdOrOptions;
  let opciones = maybeOptions;
  if (usuarioIdOrOptions && typeof usuarioIdOrOptions === 'object' && !Array.isArray(usuarioIdOrOptions)) {
    usuarioId = usuarioIdOrOptions.usuarioId || null;
    opciones = usuarioIdOrOptions;
  }

  const errores = validarDatos(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const targetDb = opciones.db || dbLocal;
  if (datos.tipo === 'RETIRO') {
    const { saldo } = await movimientoCajaRepository.getSaldoTotal(targetDb);
    if (Number(saldo) < Number(datos.monto)) {
      throw new AppError(
        `Saldo insuficiente. Saldo actual: $${saldo}`,
        422,
        'SALDO_INSUFICIENTE'
      );
    }
  }

  const actorId = opciones.actorId || usuarioId || 'cajero_principal';
  const opId = opciones.operationId || crypto.randomUUID();

  return await runBusinessMutation({
    db: targetDb,
    localDb: opciones.localDb || null,
    operationId: opId,
    actorId,
    operationType: 'CREAR_MOVIMIENTO_CAJA',
    payload: { ...datos, usuario_id: usuarioId },
    execute: async ({ db, trx, collector, isOffline }) => {
      if (datos.tipo === 'RETIRO') {
        const { saldo } = await movimientoCajaRepository.getSaldoTotal(trx);
        if (Number(saldo) < Number(datos.monto)) {
          throw new AppError(
            `Saldo insuficiente. Saldo actual: $${saldo}`,
            422,
            'SALDO_INSUFICIENTE'
          );
        }
      }

      const creado = await movimientoCajaRepository.create(
        {
          ...datos,
          usuario_id: usuarioId,
        },
        trx
      );

      if (collector) {
        collector.recordInsert('movimientos_caja', creado.id, {
          id: creado.id,
          fecha: creado.fecha,
          hora: creado.hora,
          tipo: creado.tipo,
          detalle: creado.detalle,
          monto: Number(creado.monto),
          usuario_id: creado.usuario_id || null,
          created_at: creado.created_at,
          updated_at: creado.updated_at
        });
      }

      return creado;
    }
  });
};

const eliminarMovimiento = async (id, opciones = {}) => {
  const targetDb = opciones.db || dbLocal;
  const movimiento = await movimientoCajaRepository.getById(id, targetDb);
  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (movimiento.tipo === 'INGRESO') {
    const { saldo } = await movimientoCajaRepository.getSaldoTotal(targetDb);
    if (Number(saldo) - Number(movimiento.monto) < 0) {
      throw new AppError(
        `No se puede eliminar este ingreso: dejaría el saldo en negativo. Saldo actual: $${saldo}`,
        422,
        'SALDO_INSUFICIENTE'
      );
    }
  }

  const actorId = opciones.actorId || opciones.usuarioId || 'cajero_principal';
  const opId = opciones.operationId || `del_mov_${id}`;

  return await runBusinessMutation({
    db: targetDb,
    localDb: opciones.localDb || null,
    operationId: opId,
    actorId,
    operationType: 'ELIMINAR_MOVIMIENTO_CAJA',
    payload: { id },
    execute: async ({ db, trx, collector, isOffline }) => {
      const movEnTrx = await movimientoCajaRepository.getById(id, trx);
      if (!movEnTrx) {
        throw new AppError('Movimiento no encontrado', 404, 'NO_ENCONTRADO');
      }

      if (movEnTrx.tipo === 'INGRESO') {
        const { saldo } = await movimientoCajaRepository.getSaldoTotal(trx);
        if (Number(saldo) - Number(movEnTrx.monto) < 0) {
          throw new AppError(
            `No se puede eliminar este ingreso: dejaría el saldo en negativo. Saldo actual: $${saldo}`,
            422,
            'SALDO_INSUFICIENTE'
          );
        }
      }

      await movimientoCajaRepository.delete(id, trx);

      if (collector) {
        collector.recordDelete('movimientos_caja', id, movEnTrx);
      }

      return { id };
    }
  });
};

const getSaldoAnterior = async (mes) => {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('mes debe tener formato YYYY-MM', 400, 'VALIDACION');
  }

  const { saldo } = await movimientoCajaRepository.getSaldoAntesDeMes(mes);
  return { mes, saldo: Number(saldo) };
};

const getMermasMes = async (mes) => {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new AppError('mes debe tener formato YYYY-MM', 400, 'VALIDACION');
  }

  const mermas = await movimientoCajaRepository.getMermasMes(mes);
  if (!mermas || mermas.length === 0) return [];

  const prodsSinCosto = mermas.filter(
    (m) => !(Number(m.precio_costo) > 0) && m.producto_id
  );

  const costoPorProducto = new Map();
  if (prodsSinCosto.length > 0) {
    const prods = await productoRepository.getAllWithDetails();
    for (const p of prods) {
      costoPorProducto.set(Number(p.id), Number(p.precio_costo || 0));
    }
  }

  return mermas.map((m) => {
    let precioCosto = Number(m.precio_costo) || 0;
    if (!precioCosto && m.producto_id) {
      precioCosto = costoPorProducto.get(Number(m.producto_id)) || 0;
    }

    const cantidad = Number(m.cantidad) || 1;
    const costoTotal = Number((cantidad * precioCosto).toFixed(2));
    return {
      ...m,
      precio_costo: precioCosto,
      costo_total: costoTotal
    };
  });
};

module.exports = {
  listarMovimientos,
  crearMovimiento,
  eliminarMovimiento,
  getSaldoAnterior,
  getMermasMes,
};
