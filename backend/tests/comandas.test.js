const request = require('supertest');
const app = require('../src/app');
const { puedeTransicionar } = require('../src/services/comandaService');
const { ESTADOS_PEDIDO } = require('../src/utils/constantes');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas unitarias de puedeTransicionar', () => {
  it('permite transicionar de pendiente a en_preparacion', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.EN_PREPARACION)).toBe(true);
  });

  it('permite transicionar de en_preparacion a en_empaque', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_PREPARACION, ESTADOS_PEDIDO.EN_EMPAQUE)).toBe(true);
  });

  it('rechaza transicionar de pendiente a en_empaque (saltar estados)', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.EN_EMPAQUE)).toBe(false);
  });

  it('rechaza transicionar de pendiente a completado o cancelado', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.COMPLETADO)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.CANCELADO)).toBe(false);
  });

  it('rechaza retroceder de en_preparacion a pendiente', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_PREPARACION, ESTADOS_PEDIDO.PENDIENTE)).toBe(false);
  });

  it('rechaza transicionar de en_preparacion a completado o cancelado', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_PREPARACION, ESTADOS_PEDIDO.COMPLETADO)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_PREPARACION, ESTADOS_PEDIDO.CANCELADO)).toBe(false);
  });

  it('rechaza cualquier transicion originada en en_empaque', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_EMPAQUE, ESTADOS_PEDIDO.COMPLETADO)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_EMPAQUE, ESTADOS_PEDIDO.PENDIENTE)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_EMPAQUE, ESTADOS_PEDIDO.EN_PREPARACION)).toBe(false);
  });

  it('rechaza cualquier transicion originada en completado o cancelado', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.COMPLETADO, ESTADOS_PEDIDO.PENDIENTE)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.CANCELADO, ESTADOS_PEDIDO.PENDIENTE)).toBe(false);
  });

  it('rechaza transiciones hacia el mismo estado', () => {
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.PENDIENTE)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.EN_PREPARACION, ESTADOS_PEDIDO.EN_PREPARACION)).toBe(false);
  });

  it('rechaza estados invalidos, nulos o indefinidos', () => {
    expect(puedeTransicionar('invalido', ESTADOS_PEDIDO.EN_PREPARACION)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, 'invalido')).toBe(false);
    expect(puedeTransicionar(null, ESTADOS_PEDIDO.EN_PREPARACION)).toBe(false);
    expect(puedeTransicionar(ESTADOS_PEDIDO.PENDIENTE, null)).toBe(false);
    expect(puedeTransicionar(undefined, undefined)).toBe(false);
  });
});

describe('Pruebas de integracion - API /api/comandas', () => {
  beforeAll(async () => {
    await resetDb();

    await dbLocal('categorias').insert({
      id: 1,
      nombre: 'Cafetería'
    });

    await dbLocal('productos').insert({
      id: 1,
      categoria_id: 1,
      nombre: 'Café Espresso',
      precio_venta: 1200.0,
      stock_actual: 50
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('GET /api/comandas/activas lista solo pedidos activos ordenados del mas antiguo al mas nuevo con sus detalles', async () => {
    await dbLocal('pedidos').insert([
      {
        id: 'PED-COM-01',
        cliente: 'Cliente Uno',
        total: 1200.0,
        estado: 'pendiente',
        tipo_pedido: 'salon',
        created_at: '2026-11-01 10:00:00'
      },
      {
        id: 'PED-COM-02',
        cliente: 'Cliente Dos',
        total: 2400.0,
        estado: 'en_preparacion',
        tipo_pedido: 'take_away',
        created_at: '2026-11-01 10:05:00'
      },
      {
        id: 'PED-COM-03',
        cliente: 'Cliente Tres',
        total: 1200.0,
        estado: 'en_empaque',
        tipo_pedido: 'salon',
        created_at: '2026-11-01 10:10:00'
      },
      {
        id: 'PED-COM-04',
        cliente: 'Cliente Cuatro',
        total: 1200.0,
        estado: 'completado',
        tipo_pedido: 'salon',
        created_at: '2026-11-01 09:00:00'
      },
      {
        id: 'PED-COM-05',
        cliente: 'Cliente Cinco',
        total: 1200.0,
        estado: 'cancelado',
        tipo_pedido: 'salon',
        created_at: '2026-11-01 09:30:00'
      }
    ]);

    await dbLocal('detalles_pedidos').insert([
      {
        id: 'DET-COM-01',
        pedido_id: 'PED-COM-01',
        producto_id: 1,
        nombre_producto: 'Café Espresso',
        cantidad: 1,
        precio_venta: 1200.0,
        precio_costo: 300.0
      },
      {
        id: 'DET-COM-02',
        pedido_id: 'PED-COM-02',
        producto_id: 1,
        nombre_producto: 'Café Espresso',
        cantidad: 2,
        precio_venta: 1200.0,
        precio_costo: 300.0
      }
    ]);

    const res = await request(app).get('/api/comandas/activas');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(3);

    const ids = res.body.data.map((p) => p.id);
    expect(ids).toEqual(['PED-COM-01', 'PED-COM-02', 'PED-COM-03']);

    const primerPedido = res.body.data[0];
    expect(Array.isArray(primerPedido.detalles)).toBe(true);
    expect(primerPedido.detalles).toHaveLength(1);
    expect(primerPedido.detalles[0].nombre_producto).toBe('Café Espresso');

    const tercerPedido = res.body.data[2];
    expect(Array.isArray(tercerPedido.detalles)).toBe(true);
    expect(tercerPedido.detalles).toHaveLength(0);
  });

  it('PATCH /api/comandas/:id/estado avanza correctamente de pendiente a en_preparacion y luego a en_empaque', async () => {
    const resPaso1 = await request(app)
      .patch('/api/comandas/PED-COM-01/estado')
      .send({ estado: 'en_preparacion' });

    expect(resPaso1.status).toBe(200);
    expect(resPaso1.body.success).toBe(true);
    expect(resPaso1.body.data.estado).toBe('en_preparacion');

    const resPaso2 = await request(app)
      .patch('/api/comandas/PED-COM-01/estado')
      .send({ estado: 'en_empaque' });

    expect(resPaso2.status).toBe(200);
    expect(resPaso2.body.success).toBe(true);
    expect(resPaso2.body.data.estado).toBe('en_empaque');
  });

  it('PATCH /api/comandas/:id/estado responde 409 TRANSICION_INVALIDA al saltar estados o transicionar indebidamente', async () => {
    await dbLocal('pedidos').insert({
      id: 'PED-COM-06',
      cliente: 'Cliente Seis',
      total: 1200.0,
      estado: 'pendiente',
      tipo_pedido: 'salon',
      created_at: '2026-11-01 11:00:00'
    });

    const resSalto = await request(app)
      .patch('/api/comandas/PED-COM-06/estado')
      .send({ estado: 'en_empaque' });

    expect(resSalto.status).toBe(409);
    expect(resSalto.body.success).toBe(false);
    expect(resSalto.body.error).toBe('TRANSICION_INVALIDA');
    expect(resSalto.body.message).toBe('No se puede pasar de pendiente a en_empaque');

    const resCompletado = await request(app)
      .patch('/api/comandas/PED-COM-06/estado')
      .send({ estado: 'completado' });

    expect(resCompletado.status).toBe(409);
    expect(resCompletado.body.success).toBe(false);
    expect(resCompletado.body.error).toBe('TRANSICION_INVALIDA');
    expect(resCompletado.body.message).toBe('No se puede pasar de pendiente a completado');
  });

  it('PATCH /api/comandas/:id/estado responde 404 al intentar cambiar estado de un pedido inexistente', async () => {
    const res = await request(app)
      .patch('/api/comandas/PED-NO-EXISTE/estado')
      .send({ estado: 'en_preparacion' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
    expect(res.body.message).toBe('Pedido inexistente');
  });

  it('PATCH /api/comandas/:id/estado responde 400 cuando el estado es inexistente o no valido', async () => {
    const res = await request(app)
      .patch('/api/comandas/PED-COM-01/estado')
      .send({ estado: 'estado_invalido' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDACION');

    const resVacio = await request(app)
      .patch('/api/comandas/PED-COM-01/estado')
      .send({});

    expect(resVacio.status).toBe(400);
    expect(resVacio.body.success).toBe(false);
    expect(resVacio.body.error).toBe('VALIDACION');
  });
});

