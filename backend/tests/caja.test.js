const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas de integración - API /api/caja', () => {
  let movimientoIngresoId;
  let movimientoRetiroId;

  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  // ─── GET /movimientos ───────────────────────────────────────────────────────

  describe('GET /api/caja/movimientos', () => {
    it('devuelve lista vacía cuando no hay movimientos', async () => {
      const res = await request(app).get('/api/caja/movimientos');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── POST /movimientos ──────────────────────────────────────────────────────

  describe('POST /api/caja/movimientos', () => {
    it('crea un INGRESO correctamente', async () => {
      const payload = {
        fecha: '2026-11-01',
        hora: '09:00:00',
        tipo: 'INGRESO',
        detalle: 'Apertura de caja',
        monto: 5000,
      };

      const res = await request(app).post('/api/caja/movimientos').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tipo).toBe('INGRESO');
      expect(res.body.data.monto).toBe(5000);
      expect(res.body.data.detalle).toBe('Apertura de caja');

      movimientoIngresoId = res.body.data.id;
    });

    it('crea un RETIRO cuando hay saldo suficiente', async () => {
      const payload = {
        fecha: '2026-11-01',
        hora: '12:00:00',
        tipo: 'RETIRO',
        detalle: 'Pago a proveedor',
        monto: 2000,
      };

      const res = await request(app).post('/api/caja/movimientos').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tipo).toBe('RETIRO');
      expect(res.body.data.monto).toBe(2000);

      movimientoRetiroId = res.body.data.id;
    });

    it('rechaza un RETIRO cuando el saldo es insuficiente (422)', async () => {
      const payload = {
        fecha: '2026-11-01',
        hora: '15:00:00',
        tipo: 'RETIRO',
        detalle: 'Retiro excesivo',
        monto: 99999,
      };

      const res = await request(app).post('/api/caja/movimientos').send(payload);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('SALDO_INSUFICIENTE');
    });

    it('rechaza si falta el campo tipo (400)', async () => {
      const res = await request(app).post('/api/caja/movimientos').send({
        fecha: '2026-11-01',
        hora: '10:00:00',
        detalle: 'Sin tipo',
        monto: 100,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });

    it('rechaza si el monto es 0 o negativo (400)', async () => {
      const res = await request(app).post('/api/caja/movimientos').send({
        fecha: '2026-11-01',
        hora: '10:00:00',
        tipo: 'INGRESO',
        detalle: 'Monto inválido',
        monto: -100,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });

    it('rechaza si falta el detalle (400)', async () => {
      const res = await request(app).post('/api/caja/movimientos').send({
        fecha: '2026-11-01',
        hora: '10:00:00',
        tipo: 'INGRESO',
        detalle: '   ',
        monto: 500,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });

    it('rechaza tipo inválido (400)', async () => {
      const res = await request(app).post('/api/caja/movimientos').send({
        fecha: '2026-11-01',
        hora: '10:00:00',
        tipo: 'TRANSFERENCIA',
        detalle: 'Tipo raro',
        monto: 500,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });
  });

  // ─── GET /movimientos con filtros ───────────────────────────────────────────

  describe('GET /api/caja/movimientos con filtros', () => {
    it('filtra por fecha exacta', async () => {
      const res = await request(app).get('/api/caja/movimientos?fecha=2026-11-01');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('filtra por rango desde/hasta', async () => {
      const res = await request(app).get('/api/caja/movimientos?desde=2026-11-01&hasta=2026-11-30');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('no devuelve registros fuera del rango', async () => {
      const res = await request(app).get('/api/caja/movimientos?desde=2025-01-01&hasta=2025-12-31');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  // ─── DELETE /movimientos/:id ────────────────────────────────────────────────

  describe('DELETE /api/caja/movimientos/:id', () => {
    it('elimina un RETIRO sin problemas', async () => {
      const res = await request(app).delete(`/api/caja/movimientos/${movimientoRetiroId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(movimientoRetiroId);
    });

    it('rechaza eliminar un INGRESO que dejaría saldo negativo (422)', async () => {
      // Primero añadimos un retiro que usa casi todo el saldo
      await request(app).post('/api/caja/movimientos').send({
        fecha: '2026-11-02',
        hora: '10:00:00',
        tipo: 'RETIRO',
        detalle: 'Retiro parcial',
        monto: 4999,
      });

      // Intentamos borrar el ingreso original de 5000 (saldo quedaría en -4999)
      const res = await request(app).delete(`/api/caja/movimientos/${movimientoIngresoId}`);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('SALDO_INSUFICIENTE');
    });

    it('devuelve 404 si el movimiento no existe', async () => {
      const res = await request(app).delete('/api/caja/movimientos/uuid-inexistente');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NO_ENCONTRADO');
    });
  });

  // ─── GET /saldo-anterior ────────────────────────────────────────────────────

  describe('GET /api/caja/saldo-anterior', () => {
    it('devuelve el saldo acumulado antes del mes indicado', async () => {
      const res = await request(app).get('/api/caja/saldo-anterior?mes=2026-11');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('mes', '2026-11');
      expect(res.body.data).toHaveProperty('saldo');
      expect(typeof res.body.data.saldo).toBe('number');
    });

    it('devuelve saldo 0 cuando no hay movimientos previos al mes', async () => {
      const res = await request(app).get('/api/caja/saldo-anterior?mes=2020-01');
      expect(res.status).toBe(200);
      expect(res.body.data.saldo).toBe(0);
    });

    it('rechaza si falta el parámetro mes (400)', async () => {
      const res = await request(app).get('/api/caja/saldo-anterior');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });

    it('rechaza formato de mes inválido (400)', async () => {
      const res = await request(app).get('/api/caja/saldo-anterior?mes=11-2026');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });
  });

  // ─── GET /mermas-mes ────────────────────────────────────────────────────────

  describe('GET /api/caja/mermas-mes', () => {
    it('devuelve lista vacía si no hay mermas en el mes indicado', async () => {
      const res = await request(app).get('/api/caja/mermas-mes?mes=2026-11');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('devuelve mermas del mes filtrando solo los motivos correctos', async () => {
      // Insertamos mermas de distintos motivos para verificar el filtro
      await dbLocal('registros_mermas').insert([
        {
          id: 'merma-test-1',
          motivo: 'VENCIDO',
          fecha: '2026-11-05',
          cantidad: 2,
          nombre_producto: 'Medialuna',
        },
        {
          id: 'merma-test-2',
          motivo: 'MERMA',
          fecha: '2026-11-06',
          cantidad: 1,
          nombre_producto: 'Croissant',
        },
        {
          id: 'merma-test-3',
          motivo: 'ROTURA',
          fecha: '2026-11-06',
          cantidad: 1,
          nombre_producto: 'Taza',
        },
      ]);

      const res = await request(app).get('/api/caja/mermas-mes?mes=2026-11');
      expect(res.status).toBe(200);

      const motivos = res.body.data.map((m) => m.motivo);
      expect(motivos).toContain('VENCIDO');
      expect(motivos).toContain('MERMA');
      expect(motivos).not.toContain('ROTURA');
    });

    it('rechaza si falta el parámetro mes (400)', async () => {
      const res = await request(app).get('/api/caja/mermas-mes');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDACION');
    });

    it('permite retirar dinero considerando el total acumulado de ventas (efectivo, tarjeta, mercadopago) sin importar el método', async () => {
      // Insertamos ventas con distintos métodos de pago y estados
      await dbLocal('pedidos').insert([
        {
          id: 'PED-VENTA-EFECTIVO',
          cliente: 'Cliente 1',
          total: 5000,
          estado: 'pendiente',
          tipo_pedido: 'salon',
          metodo_pago: 'efectivo',
          fecha: '2026-11-07',
          hora: '10:00:00'
        },
        {
          id: 'PED-VENTA-TARJETA',
          cliente: 'Cliente 2',
          total: 5000,
          estado: 'pendiente',
          tipo_pedido: 'salon',
          metodo_pago: 'credito',
          fecha: '2026-11-07',
          hora: '10:05:00'
        }
      ]);

      // Intentamos retirar 10.000 (disponible gracias a las dos ventas)
      const resRetiro = await request(app).post('/api/caja/movimientos').send({
        fecha: '2026-11-07',
        hora: '10:30:00',
        tipo: 'RETIRO',
        detalle: 'Retiro total de caja mixta',
        monto: 10000
      });

      expect(resRetiro.status).toBe(201);
      expect(resRetiro.body.success).toBe(true);
      expect(resRetiro.body.data.monto).toBe(10000);
    });
  });
});
