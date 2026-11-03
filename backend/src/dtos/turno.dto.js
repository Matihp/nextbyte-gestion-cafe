const { ESTADOS_TURNO } = require('../utils/constantes');
const { esFechaValida } = require('../utils/fechas');

const validarTurno = (body = {}) => {
  const errores = [];

  if (!body.empleado_id || typeof body.empleado_id !== 'string' || body.empleado_id.trim() === '') {
    errores.push('El empleado_id es obligatorio');
  }

  if (!body.fecha || !esFechaValida(body.fecha)) {
    errores.push('La fecha es inválida (debe ser formato YYYY-MM-DD)');
  }

  if (!body.estado || !ESTADOS_TURNO.includes(body.estado)) {
    errores.push(`El estado es inválido. Valores permitidos: ${ESTADOS_TURNO.join(', ')}`);
  }

  return errores;
};

const agruparPorEmpleado = (turnos = []) => {
  const resultado = {};
  if (!Array.isArray(turnos)) return resultado;

  for (const t of turnos) {
    if (!t.empleado_id) continue;
    if (!resultado[t.empleado_id]) {
      resultado[t.empleado_id] = {};
    }
    if (t.fecha) {
      resultado[t.empleado_id][t.fecha] = t.estado;
    }
  }

  return resultado;
};

module.exports = {
  validarTurno,
  agruparPorEmpleado
};

