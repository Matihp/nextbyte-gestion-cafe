const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { validarTurno, agruparPorEmpleado } = require('../src/dtos/turno.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas unitarias de turnos', () => {
  it('validarTurno acepta un cuerpo valido con todos los campos correctos', () => {
    const errores = validarTurno({
      empleado_id: 'EMP-001',
      fecha: '2026-11-05',
      estado: 'presente'
    });
    expect(errores).toHaveLength(0);
  });

  it('validarTurno detecta fecha inexistente como 2026-02-30', () => {
    const errores = validarTurno({
      empleado_id: 'EMP-001',
      fecha: '2026-02-30',
      estado: 'presente'
    });
    expect(errores).toContain('La fecha es inválida (debe ser formato YYYY-MM-DD)');
  });

  it('validarTurno detecta empleado_id faltante, fecha mal formada y estado invalido', () => {
    const errores = validarTurno({
      empleado_id: '',
      fecha: '05/11/2026',
      estado: 'vacaciones'
    });
    expect(errores.length).toBeGreaterThanOrEqual(3);
    expect(errores).toContain('El empleado_id es obligatorio');
    expect(errores).toContain('La fecha es inválida (debe ser formato YYYY-MM-DD)');
    expect(errores.some((e) => e.includes('El estado es inválido'))).toBe(true);
  });

  it('agruparPorEmpleado organiza los turnos en un diccionario por empleado y fecha', () => {
    const turnos = [
      { empleado_id: 'EMP-01', fecha: '2026-11-01', estado: 'presente' },
      { empleado_id: 'EMP-01', fecha: '2026-11-02', estado: 'franco' },
      { empleado_id: 'EMP-02', fecha: '2026-11-01', estado: 'ausente' }
    ];

    const agrupados = agruparPorEmpleado(turnos);
    expect(agrupados).toEqual({
      'EMP-01': {
        '2026-11-01': 'presente',
        '2026-11-02': 'franco'
      },
      'EMP-02': {
        '2026-11-01': 'ausente'
      }
    });
  });

  it('agruparPorEmpleado retorna un objeto vacio cuando no hay turnos', () => {
    expect(agruparPorEmpleado([])).toEqual({});
    expect(agruparPorEmpleado(null)).toEqual({});
  });
});

describe('Integración endpoints de turnos', () => {
  const authOriginal = process.env.AUTH_ENABLED;
  const jwtOriginal = process.env.JWT_SECRET;
  let token;
  const empIdValido = 'EMP-TURNO-TEST-01';
  const empIdSecundario = 'EMP-TURNO-TEST-02';

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'secreto_turnos_test';
    await resetDb();

    await dbLocal('roles').insert({
      id: 'ROL-TURNOS-TEST',
      nombre: 'Administrador',
      es_admin: 1,
      permisos: JSON.stringify(['all'])
    });

    const hash = await bcrypt.hash('claveSegura123', 10);

    await dbLocal('empleados').insert([
      {
        id: empIdValido,
        rol_id: 'ROL-TURNOS-TEST',
        legajo: 'LEG-TUR-01',
        nombre: 'Martin',
        apellido: 'Perez',
        email: 'martin.turnos@nextbyte.com',
        contrasena: hash,
        permisos: JSON.stringify(['all'])
      },
      {
        id: empIdSecundario,
        rol_id: 'ROL-TURNOS-TEST',
        legajo: 'LEG-TUR-02',
        nombre: 'Lucia',
        apellido: 'Gomez',
        email: 'lucia.turnos@nextbyte.com',
        contrasena: hash,
        permisos: JSON.stringify(['all'])
      }
    ]);

    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'martin.turnos@nextbyte.com', contrasena: 'claveSegura123' });
    token = resLogin.body.data.token;
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

  it('PUT /api/turnos requiere autenticacion', async () => {
    const res = await request(app)
      .put('/api/turnos')
      .send({
        empleado_id: empIdValido,
        fecha: '2026-11-10',
        estado: 'presente'
      });

    expect(res.status).toBe(401);
  });

  it('PUT /api/turnos crea un nuevo turno correctamente', async () => {
    const res = await request(app)
      .put('/api/turnos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empleado_id: empIdValido,
        fecha: '2026-11-10',
        estado: 'presente'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.empleado_id).toBe(empIdValido);
    expect(res.body.data.fecha).toBe('2026-11-10');
    expect(res.body.data.estado).toBe('presente');
  });

  it('PUT /api/turnos con misma fecha y empleado actualiza sin duplicar la fila', async () => {
    const res = await request(app)
      .put('/api/turnos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empleado_id: empIdValido,
        fecha: '2026-11-10',
        estado: 'tarde'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estado).toBe('tarde');

    const filas = await dbLocal('turnos_empleados').where({
      empleado_id: empIdValido,
      fecha: '2026-11-10'
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('tarde');
  });

  it('PUT /api/turnos responde 404 si el empleado_id no existe', async () => {
    const res = await request(app)
      .put('/api/turnos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empleado_id: 'EMP-INEXISTENTE-999',
        fecha: '2026-11-10',
        estado: 'presente'
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Empleado no encontrado');
  });

  it('PUT /api/turnos responde 400 si los datos son invalidos', async () => {
    const res = await request(app)
      .put('/api/turnos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empleado_id: empIdValido,
        fecha: '2026-02-30',
        estado: 'estado_invalido'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/turnos permite consultar por rango de fechas y filtros', async () => {
    await request(app)
      .put('/api/turnos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        empleado_id: empIdSecundario,
        fecha: '2026-11-15',
        estado: 'franco'
      });

    const resRango = await request(app)
      .get('/api/turnos?desde=2026-11-01&hasta=2026-11-30')
      .set('Authorization', `Bearer ${token}`);

    expect(resRango.status).toBe(200);
    expect(resRango.body.success).toBe(true);
    expect(Array.isArray(resRango.body.data)).toBe(true);
    expect(resRango.body.data.length).toBeGreaterThanOrEqual(2);

    const resEmpleado = await request(app)
      .get(`/api/turnos?empleado_id=${empIdSecundario}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resEmpleado.status).toBe(200);
    expect(resEmpleado.body.data).toHaveLength(1);
    expect(resEmpleado.body.data[0].empleado_id).toBe(empIdSecundario);
  });

  it('GET /api/turnos con agrupado=true devuelve la estructura formateada por empleado', async () => {
    const res = await request(app)
      .get('/api/turnos?agrupado=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data).toBe('object');
    expect(res.body.data[empIdValido]).toBeDefined();
    expect(res.body.data[empIdValido]['2026-11-10']).toBe('tarde');
  });

  it('GET /api/turnos responde 400 si desde es posterior a hasta', async () => {
    const res = await request(app)
      .get('/api/turnos?desde=2026-11-20&hasta=2026-11-10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('El parámetro "desde" no puede ser mayor que "hasta"');
  });

  it('DELETE /api/turnos/:id elimina el turno o devuelve 404 si no existe', async () => {
    const turnoExistente = await dbLocal('turnos_empleados')
      .where({ empleado_id: empIdValido, fecha: '2026-11-10' })
      .first();

    const resDelete = await request(app)
      .delete(`/api/turnos/${turnoExistente.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resDelete.status).toBe(200);
    expect(resDelete.body.success).toBe(true);

    const borrado = await dbLocal('turnos_empleados')
      .where({ id: turnoExistente.id })
      .first();
    expect(borrado).toBeUndefined();

    const res404 = await request(app)
      .delete('/api/turnos/ID-INEXISTENTE-123')
      .set('Authorization', `Bearer ${token}`);

    expect(res404.status).toBe(404);
    expect(res404.body.success).toBe(false);
  });
});

