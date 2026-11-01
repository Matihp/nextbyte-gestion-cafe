const reporteService = require('../services/reporteService');
const { ok } = require('../utils/respuesta');

const obtenerVentasDia = async (req, res) => {
  const data = await reporteService.obtenerVentasDia(req.query.fecha);
  return ok(res, data);
};

const obtenerVentasRango = async (req, res) => {
  const data = await reporteService.obtenerVentasRango(req.query.desde, req.query.hasta);
  return ok(res, data);
};

const obtenerTopProductos = async (req, res) => {
  const data = await reporteService.obtenerTopProductos(req.query.desde, req.query.hasta, req.query.limit);
  return ok(res, data);
};

const obtenerGanancias = async (req, res) => {
  const data = await reporteService.obtenerGanancias(req.query.desde, req.query.hasta);
  return ok(res, data);
};

const obtenerMermas = async (req, res) => {
  const data = await reporteService.obtenerMermas(req.query.desde, req.query.hasta);
  return ok(res, data);
};

const obtenerResumen = async (req, res) => {
  const data = await reporteService.obtenerResumen();
  return ok(res, data);
};

module.exports = {
  obtenerVentasDia,
  obtenerVentasRango,
  obtenerTopProductos,
  obtenerGanancias,
  obtenerMermas,
  obtenerResumen
};
