const mermaService = require('../services/mermaService');
const { ok } = require('../utils/respuesta');

const obtenerTodas = async (req, res) => {
  const mermas = await mermaService.obtenerTodas(req.query);
  return ok(res, mermas);
};

const obtenerPorId = async (req, res) => {
  const merma = await mermaService.obtenerPorId(req.params.id);
  return ok(res, merma);
};

const crear = async (req, res) => {
  const merma = await mermaService.crear(req.body);
  return ok(res, merma, 201);
};

const eliminar = async (req, res) => {
  const resultado = await mermaService.eliminar(req.params.id);
  return ok(res, resultado);
};

module.exports = {
  obtenerTodas,
  obtenerPorId,
  crear,
  eliminar,
};

