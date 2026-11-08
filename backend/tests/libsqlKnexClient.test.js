const path = require('path');
const fs = require('fs');
const knex = require('knex');
const { createClient } = require('@libsql/client');
const { getEventListeners } = require('events');
const LibsqlKnexClient = require('../src/config/libsqlKnexClient');
const { isNetworkError, isCloudUnavailable } = require('../src/config/databaseErrors');

jest.setTimeout(20000);

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(() => { throw new Error('Red real prohibida en tests del adaptador'); });
});
afterAll(() => { global.fetch = originalFetch; });

const migrationsDirectory = path.join(__dirname, '../src/db/migrations');
const resultSet = (rows = [], changes = 0) => ({
  rows, rowsAffected: changes, lastInsertRowid: undefined
});
const networkError = () => Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
const makeDb = (extra = {}) => knex({
  client: LibsqlKnexClient,
  connection: { url: 'file::memory:' },
  useNullAsDefault: true,
  pool: { min: 1, max: 1 },
  acquireConnectionTimeout: 2000,
  log: { warn: jest.fn() },
  ...extra
});

describe('LibsqlKnexClient con @libsql/client real, file::memory: y pool de uno', () => {
  let db;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(async () => {
    await db.destroy();
  });

  const createItems = (connection) => connection.schema.createTable('items', (table) => {
    table.increments('id');
    table.string('name').notNullable().unique();
    table.boolean('active').notNullable().defaultTo(false);
    table.integer('quantity').notNullable().defaultTo(0);
  });

  it('create/hasTable/columnInfo, insert IDs y returning, select/first/pluck y bindings booleanos', async () => {
    await createItems(db);
    expect(await db.schema.hasTable('items')).toBe(true);
    expect(await db('items').columnInfo()).toHaveProperty('active');
    expect(await db('items').insert({ name: 'cafe', active: true })).toEqual([1]);
    expect(await db('items').insert({ name: 'te', active: false }).returning(['id', 'name', 'active']))
      .toEqual([{ id: 2, name: 'te', active: 0 }]);
    expect(await db('items').select('name', 'active').orderBy('id'))
      .toEqual([{ name: 'cafe', active: 1 }, { name: 'te', active: 0 }]);
    expect(await db('items').where('active', true).first('name')).toEqual({ name: 'cafe' });
    expect(await db('items').where('active', false).pluck('name')).toEqual(['te']);
    expect(await db('items').where('id', -1).first()).toBeUndefined();
    expect(await db.raw('SELECT ? AS yes, ? AS no, ? AS missing', [true, false, null]))
      .toEqual([{ yes: 1, no: 0, missing: null }]);
  });

  it('update returning/changes, increment, delete y raw conservan semántica SQLite de Knex', async () => {
    await createItems(db);
    await db('items').insert([{ name: 'cafe' }, { name: 'te' }]);
    expect(await db('items').update({ active: true })).toBe(2);
    expect(await db('items').where('id', -1).update({ active: false })).toBe(0);
    expect(await db('items').where('id', 1).update({ quantity: 2 }).returning(['id', 'quantity']))
      .toEqual([{ id: 1, quantity: 2 }]);
    expect(await db('items').where('id', 1).increment('quantity', 3)).toBe(1);
    expect(await db.raw('SELECT quantity FROM items WHERE id = ?', [1])).toEqual([{ quantity: 5 }]);
    expect(await db('items').where('id', 1).del()).toBe(1);
    expect(await db('items').where('id', 1).del()).toBe(0);
    expect(await db.raw('UPDATE items SET quantity = ?', [7])).toEqual([]);
    expect(await db('items').first('quantity')).toEqual({ quantity: 7 });
  });

  it('commit hace persistir cambios y rollback los revierte sin inutilizar el pool', async () => {
    await createItems(db);
    expect(await db.transaction(async (trx) => {
      await trx('items').insert({ name: 'committed', active: true });
      expect(await trx('items').first('active')).toEqual({ active: 1 });
      return 'ok';
    })).toBe('ok');
    const failure = new Error('rollback deliberado');
    await expect(db.transaction(async (trx) => {
      await trx('items').insert({ name: 'rolled-back' });
      await trx('items').where('name', 'committed').update({ active: false });
      throw failure;
    })).rejects.toBe(failure);
    expect(await db('items').select('name', 'active')).toEqual([{ name: 'committed', active: 1 }]);
    await db('items').insert({ name: 'after-rollback' });
    expect(await db('items').count('* as count').first()).toEqual({ count: 2 });
  });

  it('transacciones anidadas usan SAVEPOINT/ROLLBACK TO/RELEASE sin cerrar la transacción exterior', async () => {
    await createItems(db);
    const sql = [];
    db.on('query', (query) => sql.push(query.sql));
    await db.transaction(async (trx) => {
      await trx('items').insert({ name: 'outer' });
      await trx.transaction(async (nested) => {
        await nested('items').insert({ name: 'nested-commit' });
      });
      await expect(trx.transaction(async (nested) => {
        await nested('items').insert({ name: 'nested-rollback' });
        throw new Error('rollback savepoint');
      })).rejects.toThrow('rollback savepoint');
      await trx('items').insert({ name: 'outer-after-savepoint' });
    });
    expect(await db('items').orderBy('id').pluck('name'))
      .toEqual(['outer', 'nested-commit', 'outer-after-savepoint']);
    expect(sql.some((statement) => /^SAVEPOINT /i.test(statement))).toBe(true);
    expect(sql.some((statement) => /^ROLLBACK TO SAVEPOINT /i.test(statement))).toBe(true);
    expect(sql.some((statement) => /^RELEASE SAVEPOINT /i.test(statement))).toBe(true);
  });

  it('foreign_keys local cambia entre execute y rechaza referencias huérfanas al activarlo', async () => {
    await db.raw('PRAGMA foreign_keys = OFF');
    expect(await db.raw('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 0 }]);
    await db.raw('PRAGMA foreign_keys = ON');
    expect(await db.raw('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    await db.schema.createTable('parents', (table) => table.integer('id').primary());
    await db.schema.createTable('children', (table) => {
      table.integer('parent_id').references('id').inTable('parents');
    });
    await expect(db('children').insert({ parent_id: 404 })).rejects.toMatchObject({
      code: expect.stringMatching(/^SQLITE_CONSTRAINT/)
    });
    expect(await db.raw('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('schema rebuild: dropColumn conserva datos, índices y foreign_keys', async () => {
    await db.raw('PRAGMA foreign_keys = ON');
    await db.schema.createTable('rebuild', (table) => {
      table.increments('id');
      table.string('name').notNullable().unique();
      table.string('obsolete');
    });
    await db('rebuild').insert({ name: 'retained', obsolete: 'removed' });
    await db.schema.createTable('rebuild_children', (table) => {
      table.integer('parent_id').references('id').inTable('rebuild').onDelete('CASCADE');
    });
    await db('rebuild_children').insert({ parent_id: 1 });
    await db.schema.alterTable('rebuild', (table) => table.dropColumn('obsolete'));
    expect(await db.schema.hasColumn('rebuild', 'obsolete')).toBe(false);
    expect(await db('rebuild').select()).toEqual([{ id: 1, name: 'retained' }]);
    expect(await db('rebuild_children').select()).toEqual([{ parent_id: 1 }]);
    expect(await db.raw('PRAGMA foreign_key_check')).toEqual([]);
    await expect(db('rebuild').insert({ name: 'retained' })).rejects.toThrow();
    expect(await db.raw('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    expect(await db.raw("SELECT name FROM sqlite_master WHERE name LIKE '_knex_temp_alter%'"))
      .toEqual([]);
  });

  it('schema rebuild: nullable().alter() conserva filas e índices y permite NULL', async () => {
    await db.schema.createTable('alter_items', (table) => {
      table.increments('id');
      table.string('name').notNullable().unique();
    });
    await db('alter_items').insert({ name: 'retained' });
    await db.schema.alterTable('alter_items', (table) => table.string('name').nullable().alter());
    expect((await db('alter_items').columnInfo()).name.nullable).toBe(true);
    expect(await db('alter_items').first()).toEqual({ id: 1, name: 'retained' });
    await db('alter_items').insert({ name: null });
    await expect(db('alter_items').insert({ name: 'retained' })).rejects.toThrow();
  });

  it('migrate.latest ejecuta TODAS las migraciones reales y una segunda ejecución es idempotente', async () => {
    const expected = fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith('.js')).sort();
    const [, applied] = await db.migrate.latest({ directory: migrationsDirectory });
    expect([...applied].sort()).toEqual(expected);
    expect(await db('knex_migrations').orderBy('name').pluck('name')).toEqual(expected);
    expect(await db.schema.hasColumn('insumos', 'proveedor_id')).toBe(false);
    expect((await db('detalles_pedidos').columnInfo()).producto_id.nullable).toBe(true);
    expect((await db('recetas').columnInfo()).producto_id.nullable).toBe(true);
    expect(await db.schema.hasColumn('productos', 'receta_id')).toBe(true);
    expect(await db.schema.hasColumn('pedidos', 'idempotency_key')).toBe(true);
    expect(await db.raw('PRAGMA foreign_key_check')).toEqual([]);
    expect((await db.migrate.latest({ directory: migrationsDirectory }))[1]).toEqual([]);
    expect(await db('knex_migrations_lock').first('is_locked')).toEqual({ is_locked: 0 });
  });
});

describe('LibsqlKnexClient: fallos controlados del cliente, sin red', () => {
  let db;
  let client;
  let connection;

  beforeEach(async () => {
    db = makeDb();
    client = {
      execute: jest.fn().mockResolvedValue(resultSet([{ value: 1 }])),
      transaction: jest.fn(),
      close: jest.fn(),
      closed: false
    };
    jest.spyOn(db.client.driver, 'createClient').mockReturnValue(client);
    connection = await db.client.acquireRawConnection();
  });

  afterEach(async () => {
    await db.client.destroyRawConnection(connection);
    await db.destroy();
    jest.restoreAllMocks();
  });

  it.each(['select', 'first', 'pluck', 'raw'])('reintenta %s exactamente una vez ante fallo de red transitorio', async (method) => {
    client.execute.mockRejectedValueOnce(networkError());
    const query = { sql: 'SELECT ? AS value', bindings: [true], method };
    expect((await db.client._query(connection, query)).response).toEqual([{ value: 1 }]);
    expect(client.execute).toHaveBeenCalledTimes(2);
    expect(client.execute).toHaveBeenNthCalledWith(1, { sql: query.sql, args: [1] });
    expect(client.execute).toHaveBeenNthCalledWith(2, { sql: query.sql, args: [1] });
  });

  it('dos fallos de SELECT se propagan, descartan la conexión y no generan un tercer intento', async () => {
    const failure = networkError();
    client.execute.mockRejectedValue(failure);
    await expect(db.client._query(connection, { sql: 'SELECT 1', method: 'select' })).rejects.toBe(failure);
    expect(client.execute).toHaveBeenCalledTimes(2);
    expect(connection.disposed).toBe(true);
    expect(db.client.validateConnection(connection)).toBe(false);
  });

  it.each([
    ['insert', 'INSERT INTO items(name) VALUES (?)'],
    ['update', 'UPDATE items SET name = ?'],
    ['del', 'DELETE FROM items WHERE name = ?'],
    ['raw', 'INSERT INTO items(name) VALUES (?)'],
    ['raw', 'WITH value AS (SELECT ?) INSERT INTO items SELECT * FROM value']
  ])('NO reproduce escrituras %s (%s), aunque el resultado del servidor sea incierto', async (method, sql) => {
    const failure = networkError();
    client.execute.mockRejectedValue(failure);
    await expect(db.client._query(connection, { sql, bindings: ['cafe'], method })).rejects.toBe(failure);
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(db.client.validateConnection(connection)).toBe(false);
  });

  it.each(['SELECT 1', 'INSERT INTO items(name) VALUES (1)'])('NO reproduce statements dentro de una transacción: %s', async (sql) => {
    const failure = networkError();
    const transaction = { execute: jest.fn().mockRejectedValue(failure), close: jest.fn() };
    connection.transaction = transaction;
    await expect(db.client._query(connection, { sql, method: sql.startsWith('SELECT') ? 'select' : 'insert' }))
      .rejects.toBe(failure);
    expect(transaction.execute).toHaveBeenCalledTimes(1);
    expect(client.execute).not.toHaveBeenCalled();
    expect(connection.disposed).toBe(true);
  });

  it.each(['BEGIN;', 'COMMIT;', 'ROLLBACK;'])('NO reproduce control transaccional fallido: %s', async (sql) => {
    const failure = networkError();
    const transaction = {
      commit: jest.fn().mockRejectedValue(failure),
      rollback: jest.fn().mockRejectedValue(failure),
      close: jest.fn()
    };
    client.transaction.mockRejectedValue(failure);
    if (!sql.startsWith('BEGIN')) connection.transaction = transaction;
    await expect(db.client._query(connection, { sql, method: 'raw' })).rejects.toBe(failure);
    if (sql.startsWith('BEGIN')) {
      expect(client.transaction).toHaveBeenCalledTimes(1);
      expect(client.transaction).toHaveBeenCalledWith('write');
    } else {
      expect(transaction[sql.startsWith('COMMIT') ? 'commit' : 'rollback']).toHaveBeenCalledTimes(1);
      expect(transaction.close).toHaveBeenCalledTimes(1);
      expect(connection.transaction).toBeNull();
    }
    expect(client.execute).not.toHaveBeenCalled();
    expect(connection.disposed).toBe(true);
  });

  it('COMMIT incierto conserva su error original aunque luego se solicite ROLLBACK, sin replay', async () => {
    const failure = networkError();
    const transaction = {
      execute: jest.fn().mockResolvedValue(resultSet([], 1)),
      commit: jest.fn().mockRejectedValue(failure),
      rollback: jest.fn().mockRejectedValue(new Error('rollback no debe ejecutarse')),
      close: jest.fn()
    };
    client.transaction.mockResolvedValue(transaction);
    await db.client._query(connection, { sql: 'BEGIN;', method: 'raw' });
    await db.client._query(connection, { sql: 'INSERT INTO items VALUES (1)', method: 'insert' });
    const outcome = db.client._query(connection, { sql: 'COMMIT;', method: 'raw' }).catch(async (error) => {
      await db.client._query(connection, { sql: 'ROLLBACK;', method: 'raw' });
      throw error;
    });
    await expect(outcome).rejects.toBe(failure);
    expect(client.transaction).toHaveBeenCalledTimes(1);
    expect(transaction.execute).toHaveBeenCalledTimes(1);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
    expect(transaction.close).toHaveBeenCalledTimes(1);
    expect(client.execute).not.toHaveBeenCalled();
    expect(connection.transaction).toBeNull();
    expect(db.client.validateConnection(connection)).toBe(false);
  });

  it('Knex propaga COMMIT incierto al caller y no reejecuta el callback ni intenta rollback remoto', async () => {
    const acquire = jest.spyOn(db.client, 'acquireRawConnection');
    const failure = networkError();
    const transaction = {
      execute: jest.fn().mockResolvedValue(resultSet([], 1)),
      commit: jest.fn().mockRejectedValue(failure),
      rollback: jest.fn().mockRejectedValue(new Error('rollback secundario')),
      close: jest.fn()
    };
    client.transaction.mockResolvedValue(transaction);
    const callback = jest.fn(async (trx) => {
      await trx.raw('INSERT INTO items VALUES (1)');
      return 'no debe resolver';
    });
    await expect(db.transaction(callback)).rejects.toBe(failure);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(client.transaction).toHaveBeenCalledTimes(1);
    expect(transaction.execute).toHaveBeenCalledTimes(1);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
    expect(transaction.close).toHaveBeenCalledTimes(1);
    expect(client.execute).not.toHaveBeenCalled();
    const pooledConnection = await acquire.mock.results[0].value;
    expect(pooledConnection.transaction).toBeNull();
    expect(pooledConnection.disposed).toBe(true);
  });

  it.each(['init', 'Request'])('fetch combina timeout con señal de %s y conserva motivo de cancelación', async (source) => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('ok'));
    const controller = new AbortController();
    const configuredFetch = db.client.driver.createClient.mock.calls[0][0].fetch;
    const input = source === 'Request'
      ? new Request('https://signals-test.invalid', { signal: controller.signal })
      : 'https://signals-test.invalid';
    const init = source === 'init' ? { signal: controller.signal, method: 'POST' } : undefined;
    await configuredFetch(input, init);
    const [forwardedInput, forwardedInit] = fetchMock.mock.calls[0];
    expect(forwardedInput).toBe(input);
    expect(forwardedInit.signal).toBeInstanceOf(AbortSignal);
    expect(forwardedInit.signal).not.toBe(controller.signal);
    expect(forwardedInit.signal.aborted).toBe(false);
    if (source === 'init') expect(forwardedInit.method).toBe('POST');
    const reason = new Error('cancelado por caller');
    controller.abort(reason);
    expect(forwardedInit.signal.aborted).toBe(true);
    expect(forwardedInit.signal.reason).toBe(reason);
  });

  it.each(['SQLITE_ERROR', 'SQLITE_CONSTRAINT_FOREIGNKEY', 'SQLITE_BUSY', 'BLOCKED'])('NO reintenta ni descarta por código %s aunque el mensaje parezca de red', async (code) => {
    const failure = Object.assign(new Error('socket timeout'), { code });
    client.execute.mockRejectedValue(failure);
    await expect(db.client._query(connection, { sql: 'SELECT 1', method: 'select' })).rejects.toBe(failure);
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(connection.disposed).toBe(false);
    expect(isNetworkError(failure)).toBe(false);
    expect(isCloudUnavailable(failure)).toBe(false);
  });

  it.each([
    ['BLOCKED', 429],
    ['SQLITE_ERROR', 503]
  ])('código %s debe prevalecer sobre HTTP %s: NO retry ni descarte por error SQL/cuota', async (code, status) => {
    const failure = Object.assign(new Error('error explícito del servidor'), { code, status });
    client.execute.mockRejectedValue(failure);
    await expect(db.client._query(connection, { sql: 'SELECT 1', method: 'select' })).rejects.toBe(failure);
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(connection.disposed).toBe(false);
    expect(isCloudUnavailable(failure)).toBe(false);
  });

  it('normaliza true/false a 1/0 sin cambiar null, strings ni buffers', async () => {
    const bytes = Buffer.from([1, 2]);
    await db.client._query(connection, {
      sql: 'SELECT ?, ?, ?, ?, ?', bindings: [true, false, null, 'false', bytes], method: 'raw'
    });
    expect(client.execute).toHaveBeenCalledWith({ sql: 'SELECT ?, ?, ?, ?, ?', args: [1, 0, null, 'false', bytes] });
  });

  it('el pool destruye la conexión fallida y crea otra para la siguiente consulta, sin replay de la escritura', async () => {
    const failure = networkError();
    client.execute.mockRejectedValue(failure);
    client.close.mockImplementation(() => { client.closed = true; });
    const replacement = {
      execute: jest.fn().mockResolvedValue(resultSet([{ value: 2 }])), close: jest.fn(), closed: false
    };
    db.client.driver.createClient.mockReset().mockReturnValueOnce(client).mockReturnValue(replacement);
    await expect(db.raw('INSERT INTO items VALUES (1)')).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(await db.raw('SELECT 2 AS value')).toEqual([{ value: 2 }]);
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(client.close).toHaveBeenCalledTimes(1);
    expect(replacement.execute).toHaveBeenCalledTimes(1);
    expect(db.client.driver.createClient).toHaveBeenCalledTimes(2);
  });

  it('destroy cierra tanto la transacción pendiente como el cliente y closed invalida conexiones', async () => {
    const transaction = { close: jest.fn() };
    connection.transaction = transaction;
    await db.client.destroyRawConnection(connection);
    expect(transaction.close).toHaveBeenCalledTimes(1);
    expect(client.close).toHaveBeenCalledTimes(1);
    client.closed = true;
    expect(db.client.validateConnection(connection)).toBe(false);
    connection.transaction = null;
    client.close.mockClear();
  });
});

describe('Clasificación de errores de base de datos', () => {
  it.each(['ECONNRESET', 'FETCH_ERROR', 'STREAM_CLOSED', 'HTTP_TIMEOUT', 'UND_ERR_SOCKET'])('%s se reconoce incluso en cause', (code) => {
    expect(isNetworkError({ cause: { code } })).toBe(true);
    expect(isCloudUnavailable({ cause: { code } })).toBe(true);
  });

  it.each([429, 500, 503])('HTTP %s es indisponibilidad y no error SQL', (status) => {
    expect(isCloudUnavailable({ status })).toBe(true);
  });

  it.each([400, 401, 403, 404])('HTTP %s no dispara retry por indisponibilidad', (status) => {
    expect(isCloudUnavailable({ status })).toBe(false);
  });

  it('termina con causas cíclicas y respeta SQL/BLOCKED antes de causas de red', () => {
    const cyclic = new Error('error de dominio');
    cyclic.cause = cyclic;
    expect(isNetworkError(cyclic)).toBe(false);
    expect(isCloudUnavailable(cyclic)).toBe(false);
    for (const code of ['BLOCKED', 'SQLITE_ERROR']) {
      expect(isCloudUnavailable({ code, cause: networkError() })).toBe(false);
      expect(isCloudUnavailable({ code: 'FETCH_ERROR', status: 503, cause: { code } })).toBe(false);
    }
  });
});

describe('Cliente HTTP real con transporte Hrana simulado, SIN red', () => {
  it('cada execute abre/cierra su stream: PRAGMA OFF local a la petición NO configura consultas posteriores', async () => {
    const requests = [];
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const payload = JSON.parse(init?.body || await input.text());
      requests.push(payload);
      // Simula el estado de una conexión/stream nuevo en cada petición HTTP.
      let foreignKeys = 1;
      const results = payload.requests.map((request) => {
        if (request.type === 'close') return { type: 'ok', response: { type: 'close' } };
        const sql = request.stmt.sql;
        if (/PRAGMA foreign_keys = OFF/i.test(sql)) foreignKeys = 0;
        const reading = /^PRAGMA foreign_keys$/i.test(sql);
        return {
          type: 'ok',
          response: {
            type: 'execute',
            result: {
              cols: reading ? [{ name: 'foreign_keys', decltype: null }] : [],
              rows: reading ? [[{ type: 'integer', value: String(foreignKeys) }]] : [],
              affected_row_count: 0,
              last_insert_rowid: null
            }
          }
        };
      });
      return new Response(JSON.stringify({ baton: null, base_url: null, results }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    });
    const client = createClient({ url: 'https://streams-test.invalid', fetch: global.fetch });
    try {
      await client.execute('PRAGMA foreign_keys = OFF');
      expect((await client.execute('PRAGMA foreign_keys')).rows.map((row) => ({ ...row })))
        .toEqual([{ foreign_keys: 1 }]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const request of requests) {
        expect(request.baton == null).toBe(true);
        expect(request.requests.map((item) => item.type)).toEqual(['execute', 'close']);
      }
      expect(requests.map((request) => request.requests[0].stmt.sql))
        .toEqual(['PRAGMA foreign_keys = OFF', 'PRAGMA foreign_keys']);
    } finally {
      client.close();
      fetchMock.mockRestore();
    }
  });

  it.each([
    ['libsql://guard-test.invalid', 'PRAGMA foreign_keys = OFF'],
    ['https://guard-test.invalid', 'pragma foreign_keys=0;'],
    ['http://guard-test.invalid', '  PRAGMA  foreign_keys = off;  ']
  ])('guard remoto %s rechaza %s antes de ejecutar o enviar HTTP', async (url, sql) => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const db = makeDb({ connection: { url } });
    try {
      await expect(db.raw(sql)).rejects.toMatchObject({ code: 'CLOUD_SCHEMA_REBUILD_UNSUPPORTED' });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await db.destroy();
      fetchMock.mockRestore();
    }
  });

  it('migración aditiva real agrega columnas e índice vía cliente HTTP, con motor SQL en memoria', async () => {
    const engine = createClient({ url: 'file::memory:' });
    const statements = [];
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const payload = JSON.parse(init?.body || await input.text());
      const results = [];
      for (const request of payload.requests) {
        if (request.type === 'close') {
          results.push({ type: 'ok', response: { type: 'close' } });
          continue;
        }
        expect(request.type).toBe('execute');
        const { sql, args = [] } = request.stmt;
        statements.push(sql);
        const argsValues = args.map((arg) => arg.type === 'null' ? null
          : arg.type === 'integer' ? Number(arg.value) : arg.value);
        const result = await engine.execute({ sql, args: argsValues });
        const encode = (value) => value == null ? { type: 'null' }
          : typeof value === 'number' ? Number.isInteger(value)
            ? { type: 'integer', value: String(value) } : { type: 'float', value }
            : { type: 'text', value: String(value) };
        results.push({
          type: 'ok', response: {
            type: 'execute', result: {
              cols: result.columns.map((name) => ({ name, decltype: null })),
              rows: result.rows.map((row) => result.columns.map((name) => encode(row[name]))),
              affected_row_count: result.rowsAffected,
              last_insert_rowid: result.lastInsertRowid == null ? null : String(result.lastInsertRowid)
            }
          }
        });
      }
      return new Response(JSON.stringify({ baton: null, base_url: null, results }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    });
    const db = makeDb({ connection: { url: 'https://migration-test.invalid' } });
    try {
      await db.schema.createTable('pedidos', (table) => table.increments('id'));
      const migration = require('../src/db/migrations/20261108000002_add_order_idempotency');
      await migration.up(db);
      expect(await db.schema.hasColumn('pedidos', 'idempotency_key')).toBe(true);
      expect(await db.schema.hasColumn('pedidos', 'idempotency_hash')).toBe(true);
      const indexes = await db.raw('PRAGMA index_list(pedidos)');
      expect(indexes).toContainEqual(expect.objectContaining({
        name: 'pedidos_idempotency_key_unique', unique: 1
      }));
      expect(await db('pedidos').insert({ idempotency_key: 'key-1', idempotency_hash: 'hash-1' }).returning('id'))
        .toEqual([{ id: 1 }]);
      expect(await db('pedidos').first('idempotency_key', 'idempotency_hash'))
        .toEqual({ idempotency_key: 'key-1', idempotency_hash: 'hash-1' });
      expect(statements.some((sql) => /^alter table/i.test(sql))).toBe(true);
      expect(statements.some((sql) => /foreign_keys\s*=\s*(OFF|0)/i.test(sql))).toBe(false);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      await db.destroy();
      engine.close();
      fetchMock.mockRestore();
    }
  });

  it.each([
    ['INSERT INTO items VALUES (1)', 1],
    ['SELECT 1', 2]
  ])('timeout HTTP en %s aborta cada fetch, respeta replay y permite limpiar cliente/pool', async (sql, attempts) => {
    const signals = [];
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const signal = init.signal;
      signals.push(signal);
      return new Promise((resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    const db = makeDb({ connection: { url: 'https://timeout-test.invalid', requestTimeoutMs: 20 } });
    const acquire = jest.spyOn(db.client, 'acquireRawConnection');
    let connection;
    try {
      const failure = await db.raw(sql).then(() => undefined, (error) => error);
      expect(failure).toBeDefined();
      expect(isCloudUnavailable(failure)).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(attempts);
      expect(new Set(signals).size).toBe(attempts);
      for (const signal of signals) {
        expect(signal.aborted).toBe(true);
        expect(signal.reason.name).toBe('TimeoutError');
        expect(getEventListeners(signal, 'abort')).toHaveLength(0);
      }
      connection = await acquire.mock.results[0].value;
      expect(connection.disposed).toBe(true);
      expect(db.client.validateConnection(connection)).toBe(false);
    } finally {
      await db.destroy();
      fetchMock.mockRestore();
    }
    expect(connection.client.closed).toBe(true);
    expect(db.client.pool).toBeUndefined();
  });
});
