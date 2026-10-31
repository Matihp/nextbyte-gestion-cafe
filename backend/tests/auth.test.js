const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { armarUsuario } = require('../src/services/authService');
const { requirePermiso, requireAdmin } = require('../src/middlewares/authRequired');
const { validarLogin } = require('../src/dtos/auth.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('armarUsuario', () => {
  it('arma el usuario y payload sin incluir el campo contrasena', () => {
    const empleado = {
      id: 'EMP-ADMIN-01',
      nombre: 'Admin',
      apellido: 'Sistema',
      email: 'admin@nextbyte.com',
      rol_id: 'ROL-ADMIN-01',
      contrasena: 'hash_secreto',
      permisos: ['all']
    };
    const rol = {
      id: 'ROL-ADMIN-01',
      nombre: 'Administrador',
      es_admin: true,
      permisos: ['all']
    };

    const { usuario, payload } = armarUsuario(empleado, rol);

    expect(usuario.contrasena).toBeUndefined();
    expect(payload.contrasena).toBeUndefined();
    expect(usuario.id).toBe('EMP-ADMIN-01');
    expect(usuario.email).toBe('admin@nextbyte.com');
    expect(usuario.es_admin).toBe(true);
  });

  it('combina permisos de empleado y rol sin duplicar y reconoce rol administrador', () => {
    const empleado = {
      id: 'EMP-ADMIN-02',
      nombre: 'Admin',
      apellido: 'Secundario',
      email: 'admin2@nextbyte.com',
      rol_id: 'ROL-ADMIN-02',
      contrasena: 'hash_secreto',
      permisos: ['pedidos']
    };
    const rol = {
      id: 'ROL-ADMIN-02',
      nombre: 'Administrador',
      es_admin: true,
      permisos: ['pedidos', 'all']
    };

    const { usuario, payload } = armarUsuario(empleado, rol);

    expect(usuario.permisos).toEqual(expect.arrayContaining(['pedidos', 'all']));
    expect(usuario.permisos.length).toBe(2);
    expect(usuario.es_admin).toBe(true);
    expect(payload.es_admin).toBe(true);
  });
});

describe('requirePermiso middleware', () => {
  const authOriginal = process.env.AUTH_ENABLED;

  beforeEach(() => {
    process.env.AUTH_ENABLED = 'true';
  });

  afterEach(() => {
    if (authOriginal === undefined) {
      delete process.env.AUTH_ENABLED;
    } else {
      process.env.AUTH_ENABLED = authOriginal;
    }
  });

  it('permite el acceso si el usuario cuenta con el permiso solicitado', () => {
    const req = { user: { id: 'usr-1', permisos: ['comandas'] } };
    const next = jest.fn();

    requirePermiso('comandas')(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('permite el acceso si el usuario cuenta con el permiso all', () => {
    const req = { user: { id: 'usr-2', permisos: ['all'] } };
    const next = jest.fn();

    requirePermiso('reportes')(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('lanza AppError 403 si el usuario carece del permiso y de all', () => {
    const req = { user: { id: 'usr-3', permisos: ['mesas'] } };
    const next = jest.fn();

    expect(() => requirePermiso('reportes')(req, {}, next)).toThrow(/Acceso denegado/);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin middleware', () => {
  const authOriginal = process.env.AUTH_ENABLED;

  beforeEach(() => {
    process.env.AUTH_ENABLED = 'true';
  });

  afterEach(() => {
    if (authOriginal === undefined) {
      delete process.env.AUTH_ENABLED;
    } else {
      process.env.AUTH_ENABLED = authOriginal;
    }
  });

  it('permite el acceso si el usuario es administrador', () => {
    const req = { user: { id: 'usr-admin', es_admin: true } };
    const next = jest.fn();

    requireAdmin(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('lanza AppError 403 si el usuario no es administrador', () => {
    const req = { user: { id: 'usr-comun', es_admin: false } };
    const next = jest.fn();

    expect(() => requireAdmin(req, {}, next)).toThrow(/Acceso denegado/);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validarLogin DTO', () => {
  it('detecta campos faltantes o vacios', () => {
    const erroresVacios = validarLogin({});
    expect(erroresVacios.length).toBe(2);

    const erroresEspacios = validarLogin({ email: '   ', contrasena: '   ' });
    expect(erroresEspacios.length).toBe(2);
  });

  it('devuelve array vacio cuando email y contrasena estan presentes', () => {
    const errores = validarLogin({ email: 'admin@nextbyte.com', contrasena: 'admin123' });
    expect(errores).toEqual([]);
  });
});

describe('Integración endpoints de autenticación', () => {
  const authOriginal = process.env.AUTH_ENABLED;
  const jwtOriginal = process.env.JWT_SECRET;
  const emailAdmin = process.env.ADMIN_EMAIL || 'admin@nextbyte.com';
  const contrasenaAdmin = process.env.ADMIN_PASSWORD || 'admin123';

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'secreto_super_seguro_test';
    await resetDb();

    await dbLocal('roles').insert({
      id: 'ROL-ADMIN-TEST',
      nombre: 'Administrador',
      es_admin: 1,
      permisos: JSON.stringify(['all'])
    });

    const contrasenaHash = await bcrypt.hash(contrasenaAdmin, 10);
    await dbLocal('empleados').insert({
      id: 'EMP-ADMIN-TEST',
      rol_id: 'ROL-ADMIN-TEST',
      legajo: 'ADM-001',
      nombre: 'Admin',
      apellido: 'Sistema',
      email: emailAdmin,
      contrasena: contrasenaHash,
      permisos: JSON.stringify(['all'])
    });
  });

  afterAll(async () => {
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

    await closeDb();
  });

  it('login correcto devuelve token y datos del usuario admin sin contrasena', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: emailAdmin, contrasena: contrasenaAdmin });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.token).toBeDefined();
    expect(typeof respuesta.body.data.token).toBe('string');
    expect(respuesta.body.data.usuario.email).toBe(emailAdmin);
    expect(respuesta.body.data.usuario.nombre).toBe('Admin');
    expect(respuesta.body.data.usuario.contrasena).toBeUndefined();
    expect(respuesta.body.data.usuario.es_admin).toBe(true);
    expect(respuesta.body.data.usuario.permisos).toEqual(expect.arrayContaining(['all']));
  });

  it('login con contrasena incorrecta responde 401', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: emailAdmin, contrasena: 'clave_erronea' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.message).toBe('Credenciales inválidas');
  });

  it('login con email inexistente responde 401', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@nextbyte.com', contrasena: contrasenaAdmin });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.message).toBe('Credenciales inválidas');
  });

  it('login con campos faltantes responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: emailAdmin });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.success).toBe(false);
  });

  it('acceso a /me sin token responde 401', async () => {
    const respuesta = await request(app).get('/api/auth/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.message).toBe('No autenticado');
  });

  it('acceso a /me con token invalido responde 401', async () => {
    const respuesta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token_falso_o_corrupto');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.message).toBe('No autenticado');
  });

  it('acceso a /me con token valido responde 200 y sin campo contrasena', async () => {
    const loginRespuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: emailAdmin, contrasena: contrasenaAdmin });

    const token = loginRespuesta.body.data.token;

    const respuesta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.email).toBe(emailAdmin);
    expect(respuesta.body.data.nombre).toBe('Admin');
    expect(respuesta.body.data.contrasena).toBeUndefined();
    expect(respuesta.body.data.permisos).toEqual(expect.arrayContaining(['all']));
  });
});
