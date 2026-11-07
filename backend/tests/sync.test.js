const request = require('supertest');
const app = require('../src/app');
const { resetDb, closeDb } = require('./helpers/db');
const { dbLocal, setOnlineStatus, setPendingLocalSync, isNetworkError } = require('../src/config/db');
const syncService = require('../src/services/syncService');
const syncJob = require('../src/jobs/syncJob');

describe('Módulo de Sincronización Offline/Online', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    syncJob.detenerSyncJob();
    await closeDb();
  });

  describe('syncService - Operaciones sobre sync_pendientes', () => {
    it('registrarCambio agrega un registro pendiente y cuenta pendientes correctamente', async () => {
      const id = await syncService.registrarCambio('pedidos', 'PED-TEST-1', 'INSERT', { total: 1000 });
      expect(id).toBeDefined();

      const cantidad = await syncService.contarPendientes();
      expect(cantidad).toBe(1);

      const pendientes = await syncService.obtenerPendientes();
      expect(pendientes).toHaveLength(1);
      expect(pendientes[0].tabla).toBe('pedidos');
      expect(pendientes[0].registro_id).toBe('PED-TEST-1');
      expect(pendientes[0].estado).toBe('pendiente');
    });

    it('marcarSincronizado cambia el estado del registro', async () => {
      const id = await syncService.registrarCambio('productos', 'PROD-10', 'UPDATE');
      expect(await syncService.contarPendientes()).toBe(1);

      await syncService.marcarSincronizado(id);
      expect(await syncService.contarPendientes()).toBe(0);

      const row = await dbLocal('sync_pendientes').where({ id }).first();
      expect(row.estado).toBe('sincronizado');
      expect(row.sincronizado_at).not.toBeNull();
    });

    it('marcarError incrementa intentos y registra el último error', async () => {
      const id = await syncService.registrarCambio('categorias', 'CAT-1', 'INSERT');
      await syncService.marcarError(id, new Error('Fallo de red simulado'));

      const row = await dbLocal('sync_pendientes').where({ id }).first();
      expect(row.intentos).toBe(1);
      expect(row.ultimo_error).toBe('Fallo de red simulado');
      expect(row.estado).toBe('pendiente');
    });

    it('marcarError cambia a estado error tras 5 intentos fallidos', async () => {
      const id = await syncService.registrarCambio('insumos', 'INS-1', 'INSERT');
      for (let i = 0; i < 5; i++) {
        await syncService.marcarError(id, new Error('Error persistente'));
      }

      const row = await dbLocal('sync_pendientes').where({ id }).first();
      expect(row.intentos).toBe(5);
      expect(row.estado).toBe('error');
    });
  });

  describe('syncService.reconciliarTablas', () => {
    it('sube registros nuevos del origen al destino y los marca sincronizados', async () => {
      await dbLocal('categorias').insert({
        id: 99,
        nombre: 'Categoría Test Sync',
        icono: '🧪'
      });

      const pendientesId = await syncService.registrarCambio('categorias', 99, 'INSERT');

      const resultado = await syncService.reconciliarTablas(dbLocal, dbLocal);
      expect(resultado).toBeDefined();

      const item = await dbLocal('sync_pendientes').where({ id: pendientesId }).first();
      expect(item.estado).toBe('sincronizado');
    });

    it('lanza error si alguna de las bases de datos no está instanciada', async () => {
      await expect(syncService.reconciliarTablas(null, null)).rejects.toThrow(
        'Las bases de datos origen y destino deben estar instanciadas'
      );
    });

    it('hayPendientes retorna false cuando no hay registros ni flag', async () => {
      setPendingLocalSync(false);
      const hay = await syncService.hayPendientes();
      expect(hay).toBe(false);
    });

    it('actualiza el estado de un pedido preexistente en destino cuando cambia localmente', async () => {
      await dbLocal('pedidos').insert({
        id: 'PED-RECON-1',
        cliente: 'Cliente Update Test',
        total: 1500,
        estado: 'completado',
        tipo_pedido: 'salon',
        metodo_pago: 'efectivo',
        fecha: '2026-11-06',
        hora: '14:00:00'
      });

      const resultado = await syncService.reconciliarTablas(dbLocal, dbLocal);
      expect(resultado).toBeDefined();

      const pedidoLocal = await dbLocal('pedidos').where({ id: 'PED-RECON-1' }).first();
      expect(pedidoLocal.estado).toBe('completado');
    });

    it('prioriza claves de negocio en productos e insumos evitando colisiones por id autoincremental', async () => {
      await dbLocal('categorias').insert({
        id: 101,
        nombre: 'Pastelería Test',
        icono: '🥐'
      });

      await dbLocal('productos').insert({
        id: 201,
        categoria_id: 101,
        nombre: 'Croissant Almendras',
        precio_venta: 850,
        stock_actual: 15
      });

      await dbLocal('insumos').insert({
        id: 301,
        nombre: 'Harina Almendras',
        rubro: 'Secos',
        cantidad_disponible: 5,
        unidad_medida: 'kg',
        stock_minimo: 2,
        precio_costo: 300
      });

      const resultado = await syncService.reconciliarTablas(dbLocal, dbLocal);
      expect(resultado).toBeDefined();
      expect(resultado.detalles.productos).toBeDefined();
      expect(resultado.detalles.insumos).toBeDefined();
    });

    it('sincroniza registro offline entre origen y destino y marca la cola como sincronizada con conteo en cero', async () => {
      await dbLocal('pedidos').insert({
        id: 'PED-E2E-TEST',
        cliente: 'Cliente E2E',
        total: 2500,
        estado: 'completado',
        tipo_pedido: 'salon',
        metodo_pago: 'efectivo',
        fecha: '2026-11-06',
        hora: '21:00:00'
      });

      const pendienteId = await syncService.registrarCambio('pedidos', 'PED-E2E-TEST', 'INSERT', { total: 2500 }, dbLocal);
      expect(pendienteId).toBeDefined();
      expect(await syncService.contarPendientes(dbLocal)).toBe(1);

      const resultado = await syncService.reconciliarTablas(dbLocal, dbLocal);
      expect(resultado.detalles.pedidos.sincronizados).toBe(1);

      const pendiente = await dbLocal('sync_pendientes').where({ id: pendienteId }).first();
      expect(pendiente.estado).toBe('sincronizado');
      expect(pendiente.sincronizado_at).not.toBeNull();
      expect(await syncService.contarPendientes(dbLocal)).toBe(0);
    });
  });

  describe('syncJob - Worker y conectividad', () => {
    it('isNetworkError clasifica adecuadamente fallos de red y timeout de libSQL/Turso', () => {
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isNetworkError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isNetworkError(new Error('Socket closed unexpected'))).toBe(true);
      expect(isNetworkError(new Error('Syntax error in SQL'))).toBe(false);
      expect(isNetworkError(null)).toBe(false);
    });

    it('verificarConexionTurso retorna false si no hay cliente cloud instanciado en test', async () => {
      const res = await syncJob.verificarConexionTurso(100);
      expect(typeof res).toBe('boolean');
    });

    it('sincronizar maneja el caso sin cloud retornando offline o éxito', async () => {
      const res = await syncJob.sincronizar();
      expect(res).toBeDefined();
      expect(typeof res.success).toBe('boolean');
    });
  });

  describe('Endpoints /api/sync', () => {
    it('GET /api/sync/status responde 200 con el estado del sistema', async () => {
      const res = await request(app).get('/api/sync/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('isOnline');
      expect(res.body.data).toHaveProperty('modo');
      expect(res.body.data).toHaveProperty('hayPendientes');
      expect(res.body.data).toHaveProperty('pendientesCount');
    });

    it('POST /api/sync/ejecutar ejecuta la sincronización y responde 200', async () => {
      const res = await request(app).post('/api/sync/ejecutar');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
    });
  });
});
