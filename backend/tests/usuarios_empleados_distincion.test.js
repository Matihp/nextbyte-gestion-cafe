const request = require('supertest');
const app = require('../src/app');
const { dbLocal } = require('../src/config/db');

describe('Distinción estricta entre Empleados del Comercio y Usuarios del Sistema', () => {
  let adminToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'secreto_usuarios_test';
    process.env.AUTH_ENABLED = 'true';

    // Insert admin role if not exists
    await dbLocal('roles').insert({
      id: 'ROL-ADMIN-TEST',
      nombre: 'Admin Test',
      es_admin: 1,
      permisos: JSON.stringify(['all'])
    }).onConflict('id').ignore();

    // Insert cashier role if not exists
    await dbLocal('roles').insert({
      id: 'ROL-CAJA-TEST',
      nombre: 'Caja Test',
      es_admin: 0,
      permisos: JSON.stringify(['dashboard', 'orders'])
    }).onConflict('id').ignore();

    // Insert Admin
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    await dbLocal('empleados').insert({
      id: 'EMP-ADMIN-ROOT',
      legajo: 'ADM-ROOT',
      nombre: 'Super',
      apellido: 'Admin',
      email: 'admin.root@nextbyte.com',
      contrasena: hash,
      rol_id: 'ROL-ADMIN-TEST',
      permisos: JSON.stringify(['all']),
      es_empleado: 1,
      tiene_usuario: 1
    }).onConflict('id').ignore();

    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin.root@nextbyte.com', contrasena: 'admin123' });
    adminToken = resLogin.body.data.token;
  });

  afterAll(async () => {
    await dbLocal('empleados').whereIn('email', [
      'admin.root@nextbyte.com',
      'juan.empleado@test.com',
      'carlos.usuario.externo@test.com'
    ]).del();
    await dbLocal('roles').whereIn('id', ['ROL-ADMIN-TEST', 'ROL-CAJA-TEST']).del();
    await dbLocal.destroy();
  });

  it('1. Crear un empleado nuevo crea automáticamente su usuario de acceso habilitado', async () => {
    const res = await request(app)
      .post('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: 'EMP-TEST-001',
        email: 'juan.empleado@test.com',
        contrasena: 'password123',
        rol_id: 'ROL-CAJA-TEST',
        permisos: ['dashboard']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verificar en BD que es_empleado = 1 y tiene_usuario = 1
    const enBd = await dbLocal('empleados').where({ email: 'juan.empleado@test.com' }).first();
    expect(enBd).toBeDefined();
    expect(Boolean(enBd.es_empleado)).toBe(true);
    expect(Boolean(enBd.tiene_usuario)).toBe(true);
  });

  it('2. Crear un usuario desde /api/usuarios crea un usuario que NO figura como empleado', async () => {
    const res = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Carlos',
        apellido: 'Externo',
        email: 'carlos.usuario.externo@test.com',
        contrasena: 'password123',
        rol_id: 'ROL-ADMIN-TEST',
        permisos: ['all']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verificar en BD que es_empleado = 0 y tiene_usuario = 1
    const enBd = await dbLocal('empleados').where({ email: 'carlos.usuario.externo@test.com' }).first();
    expect(enBd).toBeDefined();
    expect(Boolean(enBd.es_empleado)).toBe(false);
    expect(Boolean(enBd.tiene_usuario)).toBe(true);

    // Verificar que NO figura en el listado de empleados de /api/empleados
    const resEmpleados = await request(app)
      .get('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`);
    const emailsEmpleados = resEmpleados.body.data.map((e) => e.email);
    expect(emailsEmpleados).not.toContain('carlos.usuario.externo@test.com');
  });

  it('3. ELIMINAR UN USUARIO QUE ES EMPLEADO NO DEBE ELIMINAR AL EMPLEADO DEL COMERCIO', async () => {
    const empleado = await dbLocal('empleados').where({ email: 'juan.empleado@test.com' }).first();
    expect(empleado).toBeDefined();

    // Eliminar el usuario desde /api/usuarios/:id
    const resDelete = await request(app)
      .delete(`/api/usuarios/${empleado.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resDelete.status).toBe(200);
    expect(resDelete.body.success).toBe(true);
    expect(resDelete.body.data.es_empleado).toBe(true);

    // El empleado SIGUE EXISTIENDO en la tabla empleados del comercio!
    const empleadoSigueEnBd = await dbLocal('empleados').where({ id: empleado.id }).first();
    expect(empleadoSigueEnBd).toBeDefined();
    expect(empleadoSigueEnBd.nombre).toBe('Juan');
    expect(empleadoSigueEnBd.legajo).toBe('EMP-TEST-001');
    expect(Boolean(empleadoSigueEnBd.es_empleado)).toBe(true);

    // Pero ya NO tiene usuario de acceso al sistema (tiene_usuario = 0)
    expect(Boolean(empleadoSigueEnBd.tiene_usuario)).toBe(false);

    // Y el empleado SIGUE apareciendo en el listado del comercio /api/empleados
    const resEmpleados = await request(app)
      .get('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`);
    const emailsEmpleados = resEmpleados.body.data.map((e) => e.email);
    expect(emailsEmpleados).toContain('juan.empleado@test.com');

    // Y el usuario YA NO aparece en el listado de usuarios del sistema /api/usuarios
    const resUsuarios = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`);
    const emailsUsuarios = resUsuarios.body.data.map((u) => u.email);
    expect(emailsUsuarios).not.toContain('juan.empleado@test.com');

    // Y no puede iniciar sesión
    const resLoginFallido = await request(app)
      .post('/api/auth/login')
      .send({ email: 'juan.empleado@test.com', contrasena: 'password123' });
    expect(resLoginFallido.status).toBe(401);
  });

  it('4. Eliminar un usuario que NO es empleado elimina el registro completamente', async () => {
    const usuarioExterno = await dbLocal('empleados').where({ email: 'carlos.usuario.externo@test.com' }).first();
    expect(usuarioExterno).toBeDefined();

    const resDelete = await request(app)
      .delete(`/api/usuarios/${usuarioExterno.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resDelete.status).toBe(200);
    expect(resDelete.body.data.es_empleado).toBe(false);

    const enBd = await dbLocal('empleados').where({ id: usuarioExterno.id }).first();
    expect(enBd).toBeUndefined();
  });
});
