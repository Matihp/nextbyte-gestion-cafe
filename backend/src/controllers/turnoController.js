const { ok } = require('../utils/respuesta');
const turnoService = require('../services/turnoService');

const listar = async (req, res) => {
  const data = await turnoService.obtenerTodos(req.query);
  ok(res, data);
};

const guardar = async (req, res) => {
  const data = await turnoService.guardar(req.body);
  ok(res, data, 200);
};

const eliminar = async (req, res) => {
  const data = await turnoService.eliminar(req.params.id);
  ok(res, data);
};

module.exports = {
  listar,
  guardar,
  eliminar
};

