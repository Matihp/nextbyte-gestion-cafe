const { dbLocal } = require('../config/db');
const movimientoCajaRepository = require('../repositories/movimientoCajaRepository');
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

  return movimientoCajaRepository.getMermasMes(mes);
};

module.exports = {
  listarMovimientos,
  crearMovimiento,
  eliminarMovimiento,
  getSaldoAnterior,
  getMermasMes,
};

