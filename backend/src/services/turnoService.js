const AppError = require('../utils/AppError');
const { esFechaValida } = require('../utils/fechas');
const { validarTurno, agruparPorEmpleado } = require('../dtos/turno.dto');
const turnoEmpleadoRepository = require('../repositories/turnoEmpleadoRepository');
const empleadoRepository = require('../repositories/empleadoRepository');

const obtenerTodos = async (filtros = {}) => {
  if (filtros.desde && !esFechaValida(filtros.desde)) {
    throw new AppError('El parámetro "desde" no es una fecha válida (YYYY-MM-DD)', 400, 'PARAMETROS_INVALIDOS');
  }

  if (filtros.hasta && !esFechaValida(filtros.hasta)) {
    throw new AppError('El parámetro "hasta" no es una fecha válida (YYYY-MM-DD)', 400, 'PARAMETROS_INVALIDOS');
  }

  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new AppError('El parámetro "desde" no puede ser mayor que "hasta"', 400, 'PARAMETROS_INVALIDOS');
  }

  const turnos = await turnoEmpleadoRepository.getAll(filtros);

  if (filtros.agrupado === 'true' || filtros.agrupado === true) {
    return agruparPorEmpleado(turnos);
  }

  return turnos;
};

const guardar = async (body) => {
  const errores = validarTurno(body);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const empleado = await empleadoRepository.getById(body.empleado_id);
  if (!empleado) {
    throw new AppError('Empleado no encontrado', 404, 'NO_ENCONTRADO');
  }

  return turnoEmpleadoRepository.upsertByDate(body.empleado_id, body.fecha, {
    estado: body.estado
  });
};

const eliminar = async (id) => {
  const turno = await turnoEmpleadoRepository.getById(id);
  if (!turno) {
    throw new AppError('Turno no encontrado', 404, 'NO_ENCONTRADO');
  }

  await turnoEmpleadoRepository.delete(id);
  return { id };
};

module.exports = {
  obtenerTodos,
  guardar,
  eliminar,
  agruparPorEmpleado,
  validarTurno
};

