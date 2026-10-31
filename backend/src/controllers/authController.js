const authService = require('../services/authService');
const { ok } = require('../utils/respuesta');

const login = async (req, res) => {
  const data = await authService.login(req.body);
  return ok(res, data);
};

const me = async (req, res) => {
  const data = await authService.me(req.user);
  return ok(res, data);
};

module.exports = {
  login,
  me
};

