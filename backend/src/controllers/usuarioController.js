const usuarioService = require('../services/usuarioService');
const { ok } = require('../utils/respuesta');

const cambiarRol = async (req, res) => {
  const data = await usuarioService.cambiarRol(req.params.id, req.body.rol_id);
  return ok(res, data);
};

const cambiarPermisos = async (req, res) => {
  const data = await usuarioService.cambiarPermisos(req.params.id, req.body.permisos);
  return ok(res, data);
};

module.exports = {
  cambiarRol,
  cambiarPermisos
};

