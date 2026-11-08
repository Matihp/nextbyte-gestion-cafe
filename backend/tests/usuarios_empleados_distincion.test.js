const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Distinción estricta entre Empleados del Comercio y Usuarios del Sistema', () => {
  let adminToken;
  const originalAuth = process.env.AUTH_ENABLED;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(async () => {
    await resetDb();
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
    if (originalAuth === undefined) delete process.env.AUTH_ENABLED;
    else process.env.AUTH_ENABLED = originalAuth;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    await closeDb();
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

  it('5. Regla de negocio: Máximo 1 usuario con el rol Caja-Contingencia (error 409 LIMITE_ROL_CONTINGENCIA)', async () => {
    // Asegurar aislamiento del test eliminando usuarios previos con rol de contingencia
    await dbLocal('empleados').where('rol_id', '877890f1-ffc8-488b-a5c4-b1caff520383').del();

    // Asegurar que el rol de contingencia exista
    await dbLocal('roles').insert({
      id: '877890f1-ffc8-488b-a5c4-b1caff520383',
      nombre: 'Caja-Contingencia (cortes internet)',
      es_admin: 0,
      permisos: JSON.stringify(['dashboard', 'orderTaking', 'orders', 'salesReport'])
    }).onConflict('id').ignore();

    // Crear el primer usuario con rol Caja-Contingencia
    const resPrimerCajero = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Primer',
        apellido: 'Cajero',
        email: 'cajero1@test.com',
        contrasena: 'password123',
        rol_id: '877890f1-ffc8-488b-a5c4-b1caff520383'
      });

    expect(resPrimerCajero.status).toBe(201);
    const primerCajeroId = resPrimerCajero.body.data.id;

    // Intentar crear un segundo usuario con el rol Caja-Contingencia debe ser rechazado con 409 LIMITE_ROL_CONTINGENCIA
    const resSegundoUsuario = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Segundo',
        apellido: 'Cajero',
        email: 'cajero2@test.com',
        contrasena: 'password123',
        rol_id: '877890f1-ffc8-488b-a5c4-b1caff520383'
      });

    expect(resSegundoUsuario.status).toBe(409);
    expect(resSegundoUsuario.body.error).toBe('LIMITE_ROL_CONTINGENCIA');

    // Intentar crear un empleado con el rol Caja-Contingencia también debe ser rechazado con 409
    const resSegundoEmpleado = await request(app)
      .post('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Tercer',
        apellido: 'Empleado',
        legajo: 'EMP-CONT-03',
        email: 'cajero3@test.com',
        contrasena: 'password123',
        rol_id: '877890f1-ffc8-488b-a5c4-b1caff520383'
      });

    expect(resSegundoEmpleado.status).toBe(409);
    expect(resSegundoEmpleado.body.error).toBe('LIMITE_ROL_CONTINGENCIA');

    // Intentar reasignar rol vía PATCH /usuarios/:id/rol a un usuario existente debe ser rechazado con 409
    const resUsuarioNormal = await request(app)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Cuarto',
        apellido: 'Normal',
        email: 'cajero4@test.com',
        contrasena: 'password123',
        rol_id: 'ROL-CAJA-TEST'
      });
    expect(resUsuarioNormal.status).toBe(201);
    const normalUserId = resUsuarioNormal.body.data.id;

    const resPatchRol = await request(app)
      .patch(`/api/usuarios/${normalUserId}/rol`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rol_id: '877890f1-ffc8-488b-a5c4-b1caff520383' });

    expect(resPatchRol.status).toBe(409);
    expect(resPatchRol.body.error).toBe('LIMITE_ROL_CONTINGENCIA');

    // Actualizar el mismo usuario existente que ya tiene el rol NO debe fallar
    const resUpdateMismo = await request(app)
      .put(`/api/usuarios/${primerCajeroId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Primer Modificado',
        rol_id: '877890f1-ffc8-488b-a5c4-b1caff520383'
      });

    expect(resUpdateMismo.status).toBe(200);

    // Limpieza
    await dbLocal('empleados').whereIn('email', [
      'cajero1@test.com',
      'cajero2@test.com',
      'cajero3@test.com',
      'cajero4@test.com'
    ]).del();
    await dbLocal('empleados').where('rol_id', '877890f1-ffc8-488b-a5c4-b1caff520383').del();
  });

  it('6. Actualizar un usuario con nueva foto guarda la URL en la base de datos', async () => {
    const fotoUrl = 'https://res.cloudinary.com/testcloud/image/upload/v123456/perfiles/avatar.jpg';

    const res = await request(app)
      .put('/api/usuarios/EMP-ADMIN-ROOT')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        foto: fotoUrl
      });

    expect(res.status).toBe(200);
    expect(res.body.data.foto).toBe(fotoUrl);

    // Verificar directamente en la base de datos
    const usuarioEnBd = await dbLocal('empleados').where({ id: 'EMP-ADMIN-ROOT' }).first();
    expect(usuarioEnBd.foto).toBe(fotoUrl);
  });
});
