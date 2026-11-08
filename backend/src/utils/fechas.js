/**
 * Fechas y horas en horario oficial de Argentina (UTC-3).
 */
const getArgentinaParts = (fecha = new Date()) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return map;
};

const hoy = (fecha = new Date()) => {
  const { year, month, day } = getArgentinaParts(fecha);
  return `${year}-${month}-${day}`;
};

const ahora = (fecha = new Date()) => {
  const { hour, minute, second } = getArgentinaParts(fecha);
  return `${hour}:${minute}:${second}`;
};

const esFechaValida = (texto) => {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

module.exports = { hoy, ahora, esFechaValida };
