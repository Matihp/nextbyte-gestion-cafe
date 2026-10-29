const AppError = require('../src/utils/AppError');
const { errorHandler } = require('../src/middlewares/errorHandler');
const validate = require('../src/middlewares/validate');
const { authRequired, requireAdmin, requirePermiso } = require('../src/middlewares/authRequired');

// Respuesta falsa para probar los middlewares sin levantar el servidor
const crearRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('errorHandler', () => {
  let errorOriginal;

  beforeEach(() => {
    errorOriginal = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = errorOriginal;
  });

  it('un AppError responde con su status, código y mensaje', () => {
    const res = crearRes();
    errorHandler(new AppError('No existe', 404, 'NO_ENCONTRADO'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'NO_ENCONTRADO', message: 'No existe' });
  });

  it('un UNIQUE de SQLite responde 409 DUPLICADO', () => {
    const res = crearRes();
    const err = Object.assign(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: categorias.nombre'), {
      code: 'SQLITE_CONSTRAINT'
    });
    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toBe('DUPLICADO');
  });

  it('una FOREIGN KEY de SQLite responde 409 RELACION', () => {
    const res = crearRes();
    const err = Object.assign(new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed'), {
      code: 'SQLITE_CONSTRAINT'
    });
    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toBe('RELACION');
  });

  it('un error desconocido responde 500 sin filtrar el detalle', () => {
    const res = crearRes();
    const entornoOriginal = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    errorHandler(new Error('detalle interno secreto'), {}, res, jest.fn());
    process.env.NODE_ENV = entornoOriginal;

    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('detalle interno secreto');
  });
});

describe('validate', () => {
  it('deja pasar si no hay errores', () => {
    const next = jest.fn();
    validate(() => [])({ body: { nombre: 'ok' } }, {}, next);

    expect(next).toHaveBeenCalled();
  });

  it('lanza AppError 400 con los mensajes si hay errores', () => {
    const next = jest.fn();

    expect(() => validate(() => ['nombre obligatorio', 'precio inválido'])({ body: {} }, {}, next)).toThrow(
      /nombre obligatorio, precio inválido/
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authRequired provisorio', () => {
  const authOriginal = process.env.AUTH_ENABLED;

  afterEach(() => {
    if (authOriginal === undefined) delete process.env.AUTH_ENABLED;
    else process.env.AUTH_ENABLED = authOriginal;
  });

  it('con AUTH_ENABLED distinto de true deja pasar todo', () => {
    process.env.AUTH_ENABLED = 'false';
    const next = jest.fn();

    authRequired({}, {}, next);
    requireAdmin({}, {}, next);
    requirePermiso('caja')({}, {}, next);

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('con AUTH_ENABLED=true responde 401 hasta que exista el login real', () => {
    process.env.AUTH_ENABLED = 'true';

    expect(() => authRequired({}, {}, jest.fn())).toThrow('No autenticado');
    expect(() => requireAdmin({}, {}, jest.fn())).toThrow('No autenticado');
    expect(() => requirePermiso('caja')({}, {}, jest.fn())).toThrow('No autenticado');
  });
});
