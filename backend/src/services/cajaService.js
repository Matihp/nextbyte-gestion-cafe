const { dbLocal } = require('../config/db');
const movimientoCajaRepository = require('../repositories/movimientoCajaRepository');
const recetaRepository = require('../repositories/recetaRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const insumoRepository = require('../repositories/insumoRepository');
const AppError = require('../utils/AppError');

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

const listarMovimientos = async (filtros = {}) => {
  return movimientoCajaRepository.getAll(filtros);
};

const crearMovimiento = async (datos, usuarioId = null) => {
  const errores = validarDatos(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  if (datos.tipo === 'RETIRO') {
    const { saldo } = await movimientoCajaRepository.getSaldoTotal();
    if (Number(saldo) < Number(datos.monto)) {
      throw new AppError(
        `Saldo insuficiente. Saldo actual: $${saldo}`,
        422,
        'SALDO_INSUFICIENTE'
      );
    }
  }

  return dbLocal.transaction(async (trx) => {
    return movimientoCajaRepository.create(
      {
        ...datos,
        usuario_id: usuarioId,
      },
      trx
    );
  });
};

const eliminarMovimiento = async (id) => {
  const movimiento = await movimientoCajaRepository.getById(id);
  if (!movimiento) {
    throw new AppError('Movimiento no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (movimiento.tipo === 'INGRESO') {
    const { saldo } = await movimientoCajaRepository.getSaldoTotal();
    if (Number(saldo) - Number(movimiento.monto) < 0) {
      throw new AppError(
        `No se puede eliminar este ingreso: dejaría el saldo en negativo. Saldo actual: $${saldo}`,
        422,
        'SALDO_INSUFICIENTE'
      );
    }
  }

  return dbLocal.transaction(async (trx) => {
    await movimientoCajaRepository.delete(id, trx);
    return { id };
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
  const insumos = await insumoRepository.getAll().catch(() => []);
  const insumosMap = new Map(insumos.map((i) => [Number(i.id), i]));

  return Promise.all(
    mermas.map(async (m) => {
      let precioCosto = Number(m.precio_costo) || 0;
      if (!precioCosto && m.producto_id) {
        try {
          const receta = await recetaRepository.getByProductoId(m.producto_id);
          if (receta) {
            const ingredientes = await ingredienteRecetaRepository.getByRecetaId(receta.id);
            if (Array.isArray(ingredientes) && ingredientes.length > 0) {
              let suma = 0;
              for (const ing of ingredientes) {
                const insumo = insumosMap.get(Number(ing.insumo_id));
                const pCosto = Number(insumo?.precio_costo || 0);
                suma += Number(ing.cantidad || 0) * pCosto;
              }
              if (suma > 0) precioCosto = Number(suma.toFixed(2));
            }
          }
        } catch (_) {}

        if (!precioCosto) {
          try {
            const detalle = await dbLocal('detalles_pedidos')
              .where({ producto_id: m.producto_id })
              .where('precio_costo', '>', 0)
              .orderBy('created_at', 'desc')
              .first();
            if (detalle && Number(detalle.precio_costo) > 0) {
              precioCosto = Number(detalle.precio_costo);
            }
          } catch (_) {}
        }
      }

      if (!precioCosto && m.nombre_producto) {
        const nombreNorm = m.nombre_producto.trim().toLowerCase();
        for (const [, insumo] of insumosMap.entries()) {
          if (insumo.nombre && insumo.nombre.trim().toLowerCase() === nombreNorm) {
            if (Number(insumo.precio_costo) > 0) {
              precioCosto = Number(insumo.precio_costo);
              break;
            }
          }
        }
      }

      const cantidad = Number(m.cantidad) || 1;
      const costoTotal = Number((cantidad * precioCosto).toFixed(2));
      return {
        ...m,
        precio_costo: precioCosto,
        costo_total: costoTotal
      };
    })
  );
};

module.exports = {
  listarMovimientos,
  crearMovimiento,
  eliminarMovimiento,
  getSaldoAnterior,
  getMermasMes,
};

