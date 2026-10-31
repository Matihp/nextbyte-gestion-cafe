const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  validarRol,
  validarPermisos,
  validarCambioRol,
  validarCambioPermisos
} = require('../src/dtos/rol.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('validarPermisos DTO', () => {
  it('detecta cuando el valor no es un array', () => {
    const errorString = validarPermisos('caja');
    expect(errorString.length).toBe(1);

    const errorObjeto = validarPermisos({ permiso: 'caja' });
    expect(errorObjeto.length).toBe(1);
  });

  it('detecta permisos que no son texto o estan vacios', () => {
    const errores = validarPermisos(['caja', '', 123, '   ']);
    expect(errores.length).toBe(1);
  });

  it('devuelve array vacio cuando los permisos son validos', () => {
    const errores = validarPermisos(['pedidos', 'comandas', 'caja']);
    expect(errores).toEqual([]);
  });
});

describe('validarRol DTO', () => {
  it('detecta nombre faltante o vacio', () => {
    const erroresFaltante = validarRol({});
    expect(erroresFaltante).toContain('El nombre es obligatorio');

    const erroresEspacios = validarRol({ nombre: '   ' });
    expect(erroresEspacios).toContain('El nombre es obligatorio');
  });

  it('detecta tipo invalido en es_admin y en permisos', () => {
    const errores = validarRol({
      nombre: 'Supervisor',
      es_admin: 'verdadero',
      permisos: 'invalido'
    });
    expect(errores).toContain('El campo es_admin debe ser un booleano');
    expect(errores).toContain('Los permisos deben ser una lista');
  });

  it('devuelve array vacio con datos validos', () => {
    const errores = validarRol({
      nombre: 'Encargado',
      es_admin: false,
      permisos: ['caja', 'pedidos']
    });
    expect(errores).toEqual([]);
  });
});

describe('validarCambioRol y validarCambioPermisos DTO', () => {
  it('validarCambioRol detecta rol_id faltante', () => {
    const errores = validarCambioRol({});
    expect(errores).toContain('El rol_id es obligatorio');
  });

  it('validarCambioPermisos detecta permisos faltantes o invalidos', () => {
    const erroresFaltantes = validarCambioPermisos({});
    expect(erroresFaltantes).toContain('Los permisos son obligatorios');

    const erroresTipo = validarCambioPermisos({ permisos: 'todos' });
    expect(erroresTipo).toContain('Los permisos deben ser una lista');
  });
});

describe('Integración endpoints de roles y usuarios', () => {
  const authOriginal = process.env.AUTH_ENABLED;
  const jwtOriginal = process.env.JWT_SECRET;
  let adminToken;
  let mozoToken;

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'secreto_super_seguro_test';
    await resetDb();

    await dbLocal('roles').insert([
      {
        id: 'ROL-ADMIN-01',
        nombre: 'Administrador',
        es_admin: 1,
        permisos: JSON.stringify(['all'])
      },
      {
        id: 'ROL-MOZO-01',
        nombre: 'Mozo',
        es_admin: 0,
        permisos: JSON.stringify(['pedidos'])
      }
    ]);

    const hashClave = await bcrypt.hash('admin123', 10);
    const hashMozo = await bcrypt.hash('mozo123', 10);

    await dbLocal('empleados').insert([
      {
        id: 'EMP-ADMIN-01',
        rol_id: 'ROL-ADMIN-01',
        legajo: 'ADM-001',
        nombre: 'Admin',
        apellido: 'Sistema',
        email: 'admin@nextbyte.com',
        contrasena: hashClave,
        permisos: JSON.stringify(['all'])
      },
      {
        id: 'EMP-MOZO-01',
        rol_id: 'ROL-MOZO-01',
        legajo: 'MOZ-001',
        nombre: 'Martin',
        apellido: 'Gomez',
        email: 'martin@nextbyte.com',
        contrasena: hashMozo,
        permisos: JSON.stringify(['salon'])
      }
    ]);

    const resLoginAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nextbyte.com', contrasena: 'admin123' });
    adminToken = resLoginAdmin.body.data.token;

    const resLoginMozo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'martin@nextbyte.com', contrasena: 'mozo123' });
    mozoToken = resLoginMozo.body.data.token;
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

  it('GET /api/roles lista todos los roles', async () => {
    const res = await request(app)
      .get('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/roles crea un rol nuevo con codigo 201', async () => {
    const res = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Cajero',
        es_admin: false,
        permisos: ['caja', 'reportes']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Cajero');
    expect(res.body.data.es_admin).toBe(false);
    expect(res.body.data.permisos).toEqual(expect.arrayContaining(['caja', 'reportes']));
  });

  it('POST /api/roles con nombre duplicado responde 409', async () => {
    const res = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Cajero',
        es_admin: false,
        permisos: ['caja']
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
  });

  it('POST /api/roles sin permisos de administrador responde 403', async () => {
    const res = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${mozoToken}`)
      .send({
        nombre: 'Auditor',
        es_admin: false
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/roles/:id con empleados asignados responde 409', async () => {
    const res = await request(app)
      .delete('/api/roles/ROL-MOZO-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('RELACION');
  });

  it('DELETE /api/roles/:id del ultimo rol admin responde 409', async () => {
    const res = await request(app)
      .delete('/api/roles/ROL-ADMIN-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('ULTIMO_ADMIN');
  });

  it('DELETE /api/roles/:id de un rol sin empleados elimina con exito', async () => {
    const rolCreado = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Temporal', es_admin: false });

    const id = rolCreado.body.data.id;

    const res = await request(app)
      .delete(`/api/roles/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/usuarios/:id/rol cambia el rol del empleado y no devuelve contrasena', async () => {
    const res = await request(app)
      .patch('/api/usuarios/EMP-MOZO-01/rol')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rol_id: 'ROL-ADMIN-01' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('EMP-MOZO-01');
    expect(res.body.data.rol_id).toBe('ROL-ADMIN-01');
    expect(res.body.data.contrasena).toBeUndefined();
  });

  it('PATCH /api/usuarios/:id/rol con empleado inexistente responde 404', async () => {
    const res = await request(app)
      .patch('/api/usuarios/EMP-FANTASMA/rol')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rol_id: 'ROL-ADMIN-01' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/usuarios/:id/permisos cambia los permisos del empleado y no devuelve contrasena', async () => {
    const res = await request(app)
      .patch('/api/usuarios/EMP-MOZO-01/permisos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permisos: ['stock', 'mermas'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.permisos).toEqual(expect.arrayContaining(['stock', 'mermas']));
    expect(res.body.data.contrasena).toBeUndefined();
  });
});

