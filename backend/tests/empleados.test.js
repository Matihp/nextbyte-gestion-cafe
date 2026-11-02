const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  esEmailValido,
  quitarContrasena,
  validarEmpleado
} = require('../src/dtos/empleado.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Funciones puras de empleados', () => {
  it('esEmailValido valida correctamente correos electronicos', () => {
    expect(esEmailValido('admin@nextbyte.com')).toBe(true);
    expect(esEmailValido('matias.dev@correo.com.ar')).toBe(true);

    expect(esEmailValido('sinarroba')).toBe(false);
    expect(esEmailValido('usuario@')).toBe(false);
    expect(esEmailValido('@dominio.com')).toBe(false);
    expect(esEmailValido(123)).toBe(false);
    expect(esEmailValido(null)).toBe(false);
  });

  it('quitarContrasena remueve el campo contrasena en objetos y arrays', () => {
    const empleado = {
      id: 'EMP-01',
      nombre: 'Lucia',
      contrasena: 'hash_super_secreto',
      email: 'lucia@nextbyte.com'
    };
    const limpio = quitarContrasena(empleado);
    expect(limpio.contrasena).toBeUndefined();
    expect(limpio.nombre).toBe('Lucia');

    const lista = [empleado, { id: 'EMP-02', contrasena: '123456' }];
    const listaLimpia = quitarContrasena(lista);
    expect(listaLimpia.every((e) => e.contrasena === undefined)).toBe(true);

    expect(quitarContrasena(null)).toBeNull();
  });

  it('validarEmpleado detecta campos obligatorios, formato de email y longitud de clave', () => {
    const errores = validarEmpleado({});
    expect(errores).toContain('El nombre es obligatorio');
    expect(errores).toContain('El apellido es obligatorio');
    expect(errores).toContain('El legajo es obligatorio');
    expect(errores).toContain('El email es obligatorio');
    expect(errores).toContain('La contraseña es obligatoria');

    const errorFormatoEmail = validarEmpleado({ email: 'invalido' });
    expect(errorFormatoEmail).toContain('El formato del email es inválido');

    const errorClaveCorta = validarEmpleado({
      nombre: 'Ana',
      apellido: 'Ruiz',
      legajo: 'LEG-1',
      email: 'ana@nextbyte.com',
      contrasena: '123'
    });
    expect(errorClaveCorta).toContain('La contraseña debe tener al menos 6 caracteres');

    const erroresEdicion = validarEmpleado(
      {
        nombre: 'Ana',
        apellido: 'Ruiz',
        legajo: 'LEG-1',
        email: 'ana@nextbyte.com'
      },
      { esEdicion: true }
    );
    expect(erroresEdicion).toEqual([]);
  });
});

describe('Integración endpoints de empleados', () => {
  const authOriginal = process.env.AUTH_ENABLED;
  const jwtOriginal = process.env.JWT_SECRET;
  let adminToken;
  let mozoToken;

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'secreto_empleados_test';
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
        permisos: JSON.stringify(['empleados'])
      }
    ]);

    const hashAdmin = await bcrypt.hash('admin123', 10);
    const hashMozo = await bcrypt.hash('mozo123', 10);

    await dbLocal('empleados').insert([
      {
        id: 'EMP-ADMIN-01',
        rol_id: 'ROL-ADMIN-01',
        legajo: 'ADM-01',
        nombre: 'Admin',
        apellido: 'Sistema',
        email: 'admin@nextbyte.com',
        contrasena: hashAdmin,
        permisos: JSON.stringify(['all'])
      },
      {
        id: 'EMP-MOZO-01',
        rol_id: 'ROL-MOZO-01',
        legajo: 'MOZ-01',
        nombre: 'Mozo',
        apellido: 'Primero',
        email: 'mozo@nextbyte.com',
        contrasena: hashMozo,
        permisos: JSON.stringify(['empleados'])
      }
    ]);

    const resLoginAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nextbyte.com', contrasena: 'admin123' });
    adminToken = resLoginAdmin.body.data.token;

    const resLoginMozo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mozo@nextbyte.com', contrasena: 'mozo123' });
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

  it('POST /api/empleados crea un empleado con contrasena hasheada y sin exponerla en la respuesta', async () => {
    const res = await request(app)
      .post('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rol_id: 'ROL-MOZO-01',
        legajo: 'LEG-100',
        nombre: 'Sofia',
        apellido: 'Lopez',
        email: 'sofia@nextbyte.com',
        contrasena: 'claveSecreta123',
        telefono: '1133445566'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.contrasena).toBeUndefined();
    expect(res.body.data.email).toBe('sofia@nextbyte.com');

    const empleadoEnBd = await dbLocal('empleados').where({ email: 'sofia@nextbyte.com' }).first();
    expect(empleadoEnBd).toBeDefined();
    expect(empleadoEnBd.contrasena).not.toBe('claveSecreta123');
    expect(bcrypt.compareSync('claveSecreta123', empleadoEnBd.contrasena)).toBe(true);
  });

  it('POST /api/empleados rechaza email duplicado con 409', async () => {
    const res = await request(app)
      .post('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legajo: 'LEG-200',
        nombre: 'Copia',
        apellido: 'Email',
        email: 'sofia@nextbyte.com',
        contrasena: 'claveSecreta123'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
    expect(res.body.message).toMatch(/email/i);
  });

  it('POST /api/empleados rechaza legajo duplicado con 409', async () => {
    const res = await request(app)
      .post('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        legajo: 'LEG-100',
        nombre: 'Copia',
        apellido: 'Legajo',
        email: 'otro@nextbyte.com',
        contrasena: 'claveSecreta123'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
    expect(res.body.message).toMatch(/legajo/i);
  });

  it('GET /api/empleados lista todos los empleados sin campo contrasena', async () => {
    const res = await request(app)
      .get('/api/empleados')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.every((e) => e.contrasena === undefined)).toBe(true);
  });

  it('GET /api/empleados/:id devuelve el empleado sin campo contrasena', async () => {
    const res = await request(app)
      .get('/api/empleados/EMP-MOZO-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('EMP-MOZO-01');
    expect(res.body.data.contrasena).toBeUndefined();
  });

  it('PUT /api/empleados/:id permite editar campos sin cambiar contrasena', async () => {
    const res = await request(app)
      .put('/api/empleados/EMP-MOZO-01')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Mozo Modificado',
        apellido: 'Primero',
        legajo: 'MOZ-01',
        email: 'mozo@nextbyte.com',
        telefono: '99887766'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Mozo Modificado');
    expect(res.body.data.contrasena).toBeUndefined();

    const enBd = await dbLocal('empleados').where({ id: 'EMP-MOZO-01' }).first();
    expect(bcrypt.compareSync('mozo123', enBd.contrasena)).toBe(true);
  });

  it('PUT /api/empleados/:id rechaza cambio de email si no es admin', async () => {
    const res = await request(app)
      .put('/api/empleados/EMP-MOZO-01')
      .set('Authorization', `Bearer ${mozoToken}`)
      .send({
        nombre: 'Mozo Modificado',
        apellido: 'Primero',
        legajo: 'MOZ-01',
        email: 'nuevoemail@nextbyte.com'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/empleados/:id rechaza que un usuario se elimine a si mismo', async () => {
    const res = await request(app)
      .delete('/api/empleados/EMP-ADMIN-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/empleados/:id elimina el empleado correctamente', async () => {
    const empleado = await dbLocal('empleados').where({ email: 'sofia@nextbyte.com' }).first();

    const res = await request(app)
      .delete(`/api/empleados/${empleado.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const enBd = await dbLocal('empleados').where({ id: empleado.id }).first();
    expect(enBd).toBeUndefined();
  });
});

