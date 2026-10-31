const jwt = require('jsonwebtoken');
const checkRoleOffline = require('../src/middlewares/checkRole');

const crearRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('checkRoleOffline middleware', () => {
  const authOriginal = process.env.AUTH_ENABLED;
  const jwtOriginal = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'secreto_offline_test';
  });

  afterEach(() => {
    if (authOriginal === undefined) {
      delete process.env.AUTH_ENABLED;
    } else {
      process.env.AUTH_ENABLED = authOriginal;
    }

    if (jwtOriginal === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = jwtOriginal;
    }
  });

  it('permite el paso cuando hay conexion activa (isOnline true)', () => {
    const req = { isOnline: true, method: 'POST', originalUrl: '/api/pedidos' };
    const res = crearRes();
    const next = jest.fn();

    checkRoleOffline(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('permite operaciones GET sin conexion para consulta de datos', () => {
    const req = { isOnline: false, method: 'GET', originalUrl: '/api/productos' };
    const res = crearRes();
    const next = jest.fn();

    checkRoleOffline(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('permite rutas exentas como health y login sin conexion', () => {
    const reqHealth = { isOnline: false, method: 'POST', originalUrl: '/api/health' };
    const resHealth = crearRes();
    const nextHealth = jest.fn();

    checkRoleOffline(reqHealth, resHealth, nextHealth);
    expect(nextHealth).toHaveBeenCalledTimes(1);

    const reqLogin = { isOnline: false, method: 'POST', originalUrl: '/api/auth/login' };
    const resLogin = crearRes();
    const nextLogin = jest.fn();

    checkRoleOffline(reqLogin, resLogin, nextLogin);
    expect(nextLogin).toHaveBeenCalledTimes(1);
  });

  it('bloquea escrituras sin conexion si el usuario no es administrador', () => {
    const req = {
      isOnline: false,
      method: 'POST',
      originalUrl: '/api/pedidos',
      user: { id: 'u1', es_admin: false }
    };
    const res = crearRes();
    const next = jest.fn();

    checkRoleOffline(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'SIN_CONEXION'
      })
    );
  });

  it('permite escrituras sin conexion cuando el usuario es administrador', () => {
    const req = {
      isOnline: false,
      method: 'POST',
      originalUrl: '/api/pedidos',
      user: { id: 'admin1', es_admin: true }
    };
    const res = crearRes();
    const next = jest.fn();

    checkRoleOffline(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('valida el token en cabecera si req.user aun no fue seteado', () => {
    const tokenAdmin = jwt.sign({ id: 'admin-jwt', es_admin: true }, 'secreto_offline_test');
    const reqAdmin = {
      isOnline: false,
      method: 'POST',
      originalUrl: '/api/roles',
      headers: { authorization: `Bearer ${tokenAdmin}` }
    };
    const resAdmin = crearRes();
    const nextAdmin = jest.fn();

    checkRoleOffline(reqAdmin, resAdmin, nextAdmin);
    expect(nextAdmin).toHaveBeenCalledTimes(1);

    const tokenMozo = jwt.sign({ id: 'mozo-jwt', es_admin: false }, 'secreto_offline_test');
    const reqMozo = {
      isOnline: false,
      method: 'POST',
      originalUrl: '/api/roles',
      headers: { authorization: `Bearer ${tokenMozo}` }
    };
    const resMozo = crearRes();
    const nextMozo = jest.fn();

    checkRoleOffline(reqMozo, resMozo, nextMozo);
    expect(nextMozo).not.toHaveBeenCalled();
    expect(resMozo.status).toHaveBeenCalledWith(403);
  });
});

