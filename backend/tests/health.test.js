const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');

describe('Estado del servidor', () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('GET /api/health responde 200 con un mensaje', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('una ruta inexistente responde 404 con success:false', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
  });

  it('los módulos registrados existen pero aún no tienen rutas (404 de ruta, no error 500)', async () => {
    const res = await request(app).get('/api/categorias');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('un JSON mal formado responde 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"mal": ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('JSON_INVALIDO');
  });
});
