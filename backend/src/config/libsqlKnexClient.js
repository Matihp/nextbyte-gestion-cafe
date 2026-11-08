const SQLiteClient = require('knex/lib/dialects/sqlite3');
const { createClient } = require('@libsql/client');
const { isCloudUnavailable } = require('./databaseErrors');

class LibsqlKnexClient extends SQLiteClient {
  _driver() {
    return { createClient };
  }

  async acquireRawConnection() {
    const { url, authToken, requestTimeoutMs = 5000 } = this.connectionSettings;
    const httpUrl = url.replace(/^libsql:/, 'https:');
    const client = this.driver.createClient({
      url: httpUrl,
      authToken,
      intMode: 'number',
      fetch: (input, init) => {
        const signals = [AbortSignal.timeout(requestTimeoutMs)];
        if (init?.signal || input?.signal) signals.push(init?.signal || input.signal);
        return fetch(input, { ...init, signal: AbortSignal.any(signals) });
      }
    });
    return { client, transaction: null, disposed: false };
  }

  validateConnection(connection) {
    return !connection.disposed && !connection.client.closed;
  }

  async destroyRawConnection(connection) {
    connection.transaction?.close();
    connection.client.close();
  }

  async _query(connection, query) {
    if (!query.sql) throw new Error('The query is empty');
    const sql = query.sql.trim();
    if (!this.connectionSettings.url.startsWith('file:') && /^PRAGMA\s+foreign_keys\s*=\s*(?:OFF|0)\b/i.test(sql)) {
      const error = new Error('La reconstrucción de tablas con foreign_keys=OFF no es segura sobre HTTP. Aplicá esta migración en mantenimiento con una herramienta de migración de Turso; las migraciones aditivas sí están soportadas.');
      error.code = 'CLOUD_SCHEMA_REBUILD_UNSUPPORTED';
      throw error;
    }
    const transactional = Boolean(connection.transaction);
    try {
      let result;
      if (/^BEGIN\b/i.test(sql)) {
        connection.transaction = await connection.client.transaction('write');
      } else if (/^COMMIT\b/i.test(sql)) {
        try {
          await connection.transaction.commit();
        } finally {
          connection.transaction.close();
          connection.transaction = null;
        }
      } else if (/^ROLLBACK\s*;?$/i.test(sql)) {
        if (connection.transaction) {
          try {
            await connection.transaction.rollback();
          } finally {
            connection.transaction.close();
            connection.transaction = null;
          }
        }
      } else {
        const execute = () => (connection.transaction || connection.client).execute({
          sql: query.sql,
          args: (query.bindings || []).map((value) => typeof value === 'boolean' ? Number(value) : value)
        });
        try {
          result = await execute();
        } catch (error) {
          // Never replay a write or a statement within an interactive transaction.
          const readOnly = ['select', 'first', 'pluck'].includes(query.method)
            || (query.method === 'raw' && /^SELECT\b/i.test(sql));
          if (transactional || !readOnly || !isCloudUnavailable(error)) throw error;
          result = await execute();
        }
      }
      query.response = result ? result.rows.map((row) => ({ ...row })) : [];
      query.context = {
        lastID: result?.lastInsertRowid == null ? undefined : Number(result.lastInsertRowid),
        changes: result?.rowsAffected || 0
      };
      return query;
    } catch (error) {
      if (isCloudUnavailable(error)) connection.disposed = true;
      throw error;
    }
  }
}

module.exports = LibsqlKnexClient;
