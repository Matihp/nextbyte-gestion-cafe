const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');

const dbPath = path.join(__dirname, '../src/config/db.js');
const dbSource = fs.readFileSync(dbPath, 'utf8');
const { isNetworkError, isCloudUnavailable } = require('../src/config/databaseErrors');

const makeKnexMock = () => {
  const emitter = new EventEmitter();
  const count = jest.fn().mockResolvedValue({ count: 0 });
  const db = jest.fn(() => ({ count: jest.fn(() => ({ first: count })) }));
  db.on = emitter.on.bind(emitter);
  db.emit = emitter.emit.bind(emitter);
  db.raw = jest.fn().mockResolvedValue([{ value: 1 }]);
  db.migrate = { latest: jest.fn().mockResolvedValue([1, []]) };
  db.seed = { run: jest.fn().mockResolvedValue([]) };
  return { db, knexMock: jest.fn(() => db) };
};

// Evalúa el db.js real, pero sin require nativo ni process.env real en rutas
// production/cloud: no puede cargar drivers, leer .env ni abrir conexiones.
const loadRouting = (environment) => {
  const { db, knexMock } = makeKnexMock();
  const config = Object.fromEntries(['test', 'turso', 'development', 'production'].map((mode) => [mode, { mode }]));
  const module = { exports: {} };
  const requireMock = (name) => {
    if (name === 'knex') return knexMock;
    if (name === '../../knexfile') return config;
    if (name === './databaseErrors') return { isNetworkError, isCloudUnavailable };
    throw new Error(`Import no permitido en sandbox: ${name}`);
  };
  vm.runInNewContext(dbSource, {
    module, exports: module.exports, require: requireMock,
    process: { env: { ...environment } }, console: { log: jest.fn() }
  }, { filename: dbPath, timeout: 1000 });
  return { api: module.exports, db, knexMock, config };
};

const cloud = {
  NODE_ENV: 'production', DB_MODE: 'cloud',
  TURSO_DB_URL: 'libsql://routing-test.invalid', TURSO_AUTH_TOKEN: 'fake-test-token'
};

describe('db.js: routing fail-closed con knex completamente simulado', () => {
  it.each([
    [{}, 'local', 'development'],
    [{ NODE_ENV: 'development' }, 'local', 'development'],
    [{ NODE_ENV: 'production', DB_MODE: 'local' }, 'local', 'production'],
    [{ NODE_ENV: 'development', DB_MODE: 'local', TURSO_DB_URL: 'ignored' }, 'local', 'development'],
    [cloud, 'cloud', 'turso'],
    [{ ...cloud, DB_MODE: undefined }, 'cloud', 'turso'],
    [{ ...cloud, NODE_ENV: 'test' }, 'test', 'test'],
    [{ NODE_ENV: 'test', DB_MODE: 'cloud' }, 'test', 'test'],
    [{ NODE_ENV: 'test', LOCAL_DB_PATH: 'must-not-open.db' }, 'test', 'test']
  ])('selecciona %s -> modo %s / config %s, una sola autoridad', (env, mode, configKey) => {
    const { api, db, knexMock, config } = loadRouting(env);
    expect(api.databaseMode).toBe(mode);
    expect(knexMock).toHaveBeenCalledTimes(1);
    expect(knexMock).toHaveBeenCalledWith(config[configKey]);
    expect(api.getActiveDb()).toBe(db);
    expect(api.dbLocal).toBe(db);
    expect(api.dbLocalDirect).toBe(mode === 'cloud' ? null : db);
    expect(api.dbCloudDirect).toBe(mode === 'cloud' ? db : null);
    expect(db.raw).not.toHaveBeenCalled();
    expect(db.migrate.latest).not.toHaveBeenCalled();
  });

  it.each([
    [{ NODE_ENV: 'production' }, 'Configuración incompleta'],
    [{ NODE_ENV: 'development', TURSO_DB_URL: 'libsql://partial.invalid' }, 'Configuración incompleta'],
    [{ NODE_ENV: 'development', TURSO_AUTH_TOKEN: 'fake-token' }, 'Configuración incompleta'],
    [{ NODE_ENV: 'production', DB_MODE: 'cloud' }, 'requiere TURSO_DB_URL'],
    [{ ...cloud, TURSO_AUTH_TOKEN: undefined }, 'requiere TURSO_DB_URL'],
    [{ ...cloud, DB_MODE: 'auto' }, 'DB_MODE debe ser cloud o local'],
    [{ NODE_ENV: 'test', DB_MODE: 'invalid' }, 'DB_MODE debe ser cloud o local']
  ])('rechaza configuración incompleta/inválida sin abrir fallback: %s', (env, message) => {
    expect(() => loadRouting(env)).toThrow(message);
  });

  it('fallo cloud se propaga, actualiza estado y jamás instancia fallback SQLite', async () => {
    const { api, db, knexMock } = loadRouting(cloud);
    const failure = Object.assign(new Error('sin red'), { code: 'FETCH_ERROR' });
    db.raw.mockRejectedValue(failure);
    await expect(api.initializeDatabase()).rejects.toBe(failure);
    expect(db.migrate.latest).not.toHaveBeenCalled();
    expect(db.seed.run).not.toHaveBeenCalled();
    expect(knexMock).toHaveBeenCalledTimes(1);
    db.emit('query-response');
    expect(api.isOnline()).toBe(true);
    db.emit('query-error', Object.assign(new Error('quota'), { code: 'BLOCKED' }));
    expect(api.isOnline()).toBe(true);
    db.emit('query-error', Object.assign(new Error('constraint'), { code: 'SQLITE_CONSTRAINT' }));
    expect(api.isOnline()).toBe(true);
    db.emit('query-error', failure);
    expect(api.isOnline()).toBe(false);
    expect(api.getActiveDb()).toBe(db);
    expect(api.dbLocalDirect).toBeNull();
    expect(knexMock).toHaveBeenCalledTimes(1);
  });

  it('initializeDatabase comparte una promesa y cloud NO migra ni siembra por defecto', async () => {
    const { api, db } = loadRouting(cloud);
    const first = api.initializeDatabase();
    expect(api.initializeDatabase()).toBe(first);
    await first;
    expect(db.raw).toHaveBeenCalledTimes(1);
    expect(db.raw).toHaveBeenCalledWith('SELECT 1');
    expect(db.migrate.latest).not.toHaveBeenCalled();
    expect(db.seed.run).not.toHaveBeenCalled();
  });

  it('cloud sólo migra con DB_AUTO_MIGRATE=true y nunca ejecuta seeds', async () => {
    const { api, db } = loadRouting({ ...cloud, DB_AUTO_MIGRATE: 'true' });
    await api.initializeDatabase();
    expect(db.migrate.latest).toHaveBeenCalledTimes(1);
    expect(db.seed.run).not.toHaveBeenCalled();
  });

  it('modo test migra memoria pero jamás ejecuta seeds de local', async () => {
    const { api, db } = loadRouting({ NODE_ENV: 'test' });
    await api.initializeDatabase();
    expect(db.migrate.latest).toHaveBeenCalledTimes(1);
    expect(db.seed.run).not.toHaveBeenCalled();
    expect(db).not.toHaveBeenCalled();
  });

  it('rechazo de migrate.latest no cambia la base ni ejecuta seeds', async () => {
    const { api, db, knexMock } = loadRouting({ ...cloud, DB_AUTO_MIGRATE: 'true' });
    const failure = new Error('schema rebuild falló');
    db.migrate.latest.mockRejectedValue(failure);
    const initialization = api.initializeDatabase();
    await expect(initialization).rejects.toBe(failure);
    expect(api.initializeDatabase()).toBe(initialization);
    expect(api.getActiveDb()).toBe(db);
    expect(db.seed.run).not.toHaveBeenCalled();
    expect(knexMock).toHaveBeenCalledTimes(1);
  });
});

describe('knexfile y carga CommonJS real de db.js, siempre NODE_ENV=test', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { NODE_ENV: 'test' };
    // No leer .env: las credenciales reales no participan de estos tests.
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.dontMock('dotenv');
    jest.dontMock('knex');
  });

  it('test usa :memory: y pool1, ignora LOCAL_DB_PATH y habilita foreign_keys', () => {
    process.env.LOCAL_DB_PATH = 'must-not-open.db';
    jest.isolateModules(() => {
      const config = require('../knexfile');
      expect(config.test.client).toBe('sqlite3');
      expect(config.test.connection).toEqual({ filename: ':memory:' });
      expect(config.test.pool.min).toBe(1);
      expect(config.test.pool.max).toBe(1);
      const conn = { run: jest.fn((sql, callback) => callback(null)) };
      const callback = jest.fn();
      config.test.pool.afterCreate(conn, callback);
      expect(conn.run).toHaveBeenCalledWith('PRAGMA foreign_keys = ON', expect.any(Function));
      expect(callback).toHaveBeenCalledWith(null, conn);
    });
  });

  it('afterCreate local configura foreign_keys, WAL y busy_timeout y propaga errores', () => {
    jest.isolateModules(() => {
      const config = require('../knexfile');
      for (const mode of ['development', 'production']) {
        const failure = new Error('pragma failure');
        const conn = { exec: jest.fn((sql, callback) => callback(failure)) };
        const callback = jest.fn();
        config[mode].pool.afterCreate(conn, callback);
        expect(conn.exec).toHaveBeenCalledWith(
          'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;', expect.any(Function)
        );
        expect(callback).toHaveBeenCalledWith(failure, conn);
      }
    });
  });

  it('turso utiliza el dialecto custom sin afterCreate que pretenda persistir PRAGMA HTTP', () => {
    jest.isolateModules(() => {
      const config = require('../knexfile');
      expect(config.turso.client).toBe(require('../src/config/libsqlKnexClient'));
      expect(config.turso.pool.afterCreate).toBeUndefined();
      expect(config.turso.connection.requestTimeoutMs).toBe(5000);
      expect(config.turso.migrations.directory).toBe(path.join(__dirname, '../src/db/migrations'));
    });
  });

  it('isolateModules db.js usa test incluso con DB_MODE=cloud y credenciales ficticias', async () => {
    Object.assign(process.env, cloud, { NODE_ENV: 'test' });
    const { db, knexMock } = makeKnexMock();
    jest.doMock('knex', () => knexMock);
    let api;
    jest.isolateModules(() => {
      const config = require('../knexfile');
      api = require('../src/config/db');
      expect(api.databaseMode).toBe('test');
      expect(knexMock).toHaveBeenCalledWith(config.test);
      expect(api.dbCloudDirect).toBeNull();
      expect(api.getActiveDb()).toBe(db);
    });
    expect(db.raw).not.toHaveBeenCalled();
  });
});
