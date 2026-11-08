const request = require('supertest');
const knex = require('knex');
const app = require('../src/app');
const { resetDb, closeDb, dbLocal } = require('./helpers/db');
const { getActiveDb, setOnlineStatus, isNetworkError } = require('../src/config/db');
const syncService = require('../src/services/syncService');
const syncJob = require('../src/jobs/syncJob');

describe('Una autoridad de datos y recuperación segura', () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it('un cambio de conectividad no cambia la base activa ni parchea prototipos de Knex', async () => {
    const other = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    try {
      const before = Object.getPrototypeOf(other.queryBuilder()).then;
      const active = getActiveDb();
      setOnlineStatus(false);
      expect(getActiveDb()).toBe(active);
      setOnlineStatus(true);
      expect(getActiveDb()).toBe(active);
      expect(Object.getPrototypeOf(dbLocal.queryBuilder()).then).toBe(before);
    } finally {
      await other.destroy();
    }
  });

  it('no copia filas locales sobre datos más recientes del destino', async () => {
    const source = jest.fn();
    const destination = jest.fn();
    await expect(syncService.reconciliarTablas(source, destination)).rejects.toMatchObject({ code: 'SYNC_DESHABILITADA' });
    expect(source).not.toHaveBeenCalled();
    expect(destination).not.toHaveBeenCalled();
  });

  it('preserva los pendientes antiguos, incluidos DELETE, sin marcarlos sincronizados', async () => {
    await dbLocal('sync_pendientes').insert({ tabla: 'pedidos', registro_id: 'PED-LEGACY', operacion: 'DELETE', estado: 'pendiente' });
    expect(await syncService.contarPendientes()).toBe(1);
    const result = await syncJob.sincronizar();
    expect(result).toMatchObject({ success: false, code: 'SYNC_DESHABILITADA' });
    await expect(syncService.marcarSincronizado(1)).rejects.toMatchObject({ code: 'SYNC_DESHABILITADA' });
    expect(await syncService.contarPendientes()).toBe(1);
    const pending = await syncService.obtenerPendientes();
    expect(pending[0]).toMatchObject({ operacion: 'DELETE', estado: 'pendiente' });
  });

  it('no abre un chequeo cloud sobre SQLite', async () => {
    expect(await syncJob.verificarConexionTurso(100)).toBe(false);
  });

  it.each([
    [new Error('fetch failed'), true],
    [{ code: 'ECONNRESET' }, true],
    [new Error('Stream is closed'), true],
    [{ cause: { code: 'ETIMEDOUT' } }, true],
    [{ code: 'SQLITE_CONSTRAINT', message: 'libsql constraint failure' }, false],
    [{ code: 'BLOCKED', message: 'libsql usage limit exceeded' }, false],
    [new Error('Syntax error in SQL'), false],
    [null, false]
  ])('clasifica fallos de red sin confundir SQL/cuotas (%#)', (error, expected) => {
    expect(isNetworkError(error)).toBe(expected);
  });

  it('informa modo y sincronización deshabilitada sin fingir réplica', async () => {
    const response = await request(app).get('/api/sync/status');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ databaseMode: 'test', syncEnabled: false });
  });

  it('rechaza la sincronización manual destructiva con 409 explícito', async () => {
    const response = await request(app).post('/api/sync/ejecutar');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ success: false, data: { code: 'SYNC_DESHABILITADA' } });
  });
});
