const request = require('supertest');
const app = require('../src/app');
const {
  calcularConsumoInsumos,
  detectarFaltantes,
  calcularTotalCosto
} = require('../src/services/comandaService');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas unitarias de completarPedido', () => {
  it('calcularConsumoInsumos calcula el consumo para un solo producto', () => {
    const detalles = [{ producto_id: 1, cantidad: 1 }];
    const recetas = {
      1: [{ insumo_id: 10, cantidad: 0.02 }]
    };
    const consumo = calcularConsumoInsumos(detalles, recetas);
    expect(consumo.get(10)).toBe(0.02);
  });

  it('calcularConsumoInsumos calcula el consumo con cantidades mayores a uno', () => {
    const detalles = [{ producto_id: 1, cantidad: 3 }];
    const recetas = {
      1: [{ insumo_id: 10, cantidad: 0.02 }]
    };
    const consumo = calcularConsumoInsumos(detalles, recetas);
    expect(consumo.get(10)).toBe(0.06);
  });

  it('calcularConsumoInsumos acumula insumos compartidos entre distintos productos', () => {
    const detalles = [
      { producto_id: 1, cantidad: 2 },
      { producto_id: 2, cantidad: 1 }
    ];
    const recetas = {
      1: [{ insumo_id: 10, cantidad: 0.02 }],
      2: [{ insumo_id: 10, cantidad: 0.03 }]
    };
    const consumo = calcularConsumoInsumos(detalles, recetas);
    expect(consumo.get(10)).toBe(0.07);
  });

  it('detectarFaltantes identifica insumos cuya cantidad requerida supera el stock disponible', () => {
    const consumo = new Map([
      [1, 5],
      [2, 10]
    ]);
    const stock = {
      1: { cantidad_disponible: 2, nombre: 'Café Grano' },
      2: { cantidad_disponible: 15, nombre: 'Leche' }
    };
    const faltantes = detectarFaltantes(consumo, stock);
    expect(faltantes).toHaveLength(1);
    expect(faltantes[0].insumo_id).toBe(1);
    expect(faltantes[0].nombre).toBe('Café Grano');
  });

  it('detectarFaltantes retorna lista vacia cuando hay suficiente stock', () => {
    const consumo = new Map([
      [1, 5],
      [2, 10]
    ]);
    const stock = {
      1: { cantidad_disponible: 5, nombre: 'Café Grano' },
      2: { cantidad_disponible: 10, nombre: 'Leche' }
    };
    const faltantes = detectarFaltantes(consumo, stock);
    expect(faltantes).toHaveLength(0);
  });

  it('calcularTotalCosto suma el costo total de los detalles correctamente', () => {
    const detalles = [
      { cantidad: 2, precio_costo: 150.0 },
      { cantidad: 1, precio_costo: 50.25 }
    ];
    const total = calcularTotalCosto(detalles);
    expect(total).toBe(350.25);
    expect(calcularTotalCosto([])).toBe(0);
  });
});

describe('Pruebas de integracion - PATCH /api/comandas/:id/completar', () => {
  beforeAll(async () => {
    await resetDb();

    await dbLocal('categorias').insert({
      id: 1,
      nombre: 'Bebidas'
    });

    await dbLocal('insumos').insert([
      {
        id: 1,
        nombre: 'Café en grano',
        rubro: 'Cafetería',
        cantidad_disponible: 1.0,
        unidad_medida: 'kg',
        stock_minimo: 0.2,
        precio_costo: 100.0
      },
      {
        id: 2,
        nombre: 'Leche entera',
        rubro: 'Lácteos',
        cantidad_disponible: 2.0,
        unidad_medida: 'lts',
        stock_minimo: 0.5,
        precio_costo: 50.0
      }
    ]);

    await dbLocal('productos').insert([
      {
        id: 1,
        categoria_id: 1,
        nombre: 'Café Latte',
        precio_venta: 1500.0,
        stock_actual: 20
      },
      {
        id: 2,
        categoria_id: 1,
        nombre: 'Alfajor Artesanal',
        precio_venta: 800.0,
        stock_actual: 5
      }
    ]);

    await dbLocal('recetas').insert({
      id: 1,
      producto_id: 1,
      nombre: 'Receta Latte'
    });

    await dbLocal('ingredientes_recetas').insert([
      {
        receta_id: 1,
        insumo_id: 1,
        cantidad: 0.02
      },
      {
        receta_id: 1,
        insumo_id: 2,
        cantidad: 0.2
      }
    ]);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('camino feliz: completa pedido en en_empaque, descuenta stock y crea el registro de venta', async () => {
    await dbLocal('pedidos').insert({
      id: 'PED-HAPPY-01',
      cliente: 'Mariana',
      total: 3000.0,
      estado: 'en_empaque',
      tipo_pedido: 'salon',
      created_at: '2026-11-01 10:00:00'
    });

    await dbLocal('detalles_pedidos').insert({
      id: 'DET-HAPPY-01',
      pedido_id: 'PED-HAPPY-01',
      producto_id: 1,
      nombre_producto: 'Café Latte',
      cantidad: 2,
      precio_venta: 1500.0,
      precio_costo: 300.0
    });

    const res = await request(app).patch('/api/comandas/PED-HAPPY-01/completar');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.estado).toBe('completado');
    expect(Array.isArray(res.body.data.insumos_descontados)).toBe(true);
    expect(res.body.data.insumos_descontados).toHaveLength(2);

    const insumoCafe = await dbLocal('insumos').where({ id: 1 }).first();
    const insumoLeche = await dbLocal('insumos').where({ id: 2 }).first();

    expect(Number(insumoCafe.cantidad_disponible)).toBeCloseTo(0.96, 2);
    expect(Number(insumoLeche.cantidad_disponible)).toBeCloseTo(1.6, 2);

    const pedidoEnDb = await dbLocal('pedidos').where({ id: 'PED-HAPPY-01' }).first();
    expect(pedidoEnDb.estado).toBe('completado');

    const venta = await dbLocal('registro_ventas').where({ pedido_id: 'PED-HAPPY-01' }).first();
    expect(venta).toBeDefined();
    expect(Number(venta.total_venta)).toBe(3000.0);
    expect(Number(venta.total_costo)).toBe(600.0);
  });

  it('stock insuficiente: responde 409 y no modifica ningun stock ni crea registro de venta', async () => {
    await dbLocal('pedidos').insert({
      id: 'PED-FAIL-01',
      cliente: 'Carlos',
      total: 150000.0,
      estado: 'en_empaque',
      tipo_pedido: 'salon',
      created_at: '2026-11-01 11:00:00'
    });

    await dbLocal('detalles_pedidos').insert({
      id: 'DET-FAIL-01',
      pedido_id: 'PED-FAIL-01',
      producto_id: 1,
      nombre_producto: 'Café Latte',
      cantidad: 100,
      precio_venta: 1500.0,
      precio_costo: 300.0
    });

    const res = await request(app).patch('/api/comandas/PED-FAIL-01/completar');

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('STOCK_INSUFICIENTE');
    expect(res.body.message).toContain('Stock insuficiente');

    const insumoCafe = await dbLocal('insumos').where({ id: 1 }).first();
    const insumoLeche = await dbLocal('insumos').where({ id: 2 }).first();

    expect(Number(insumoCafe.cantidad_disponible)).toBeCloseTo(0.96, 2);
    expect(Number(insumoLeche.cantidad_disponible)).toBeCloseTo(1.6, 2);

    const pedidoEnDb = await dbLocal('pedidos').where({ id: 'PED-FAIL-01' }).first();
    expect(pedidoEnDb.estado).toBe('en_empaque');

    const venta = await dbLocal('registro_ventas').where({ pedido_id: 'PED-FAIL-01' }).first();
    expect(venta).toBeUndefined();
  });

  it('completar dos veces el mismo pedido: la segunda vez devuelve 409 y no vuelve a descontar stock', async () => {
    const resSegundaVez = await request(app).patch('/api/comandas/PED-HAPPY-01/completar');

    expect(resSegundaVez.status).toBe(409);
    expect(resSegundaVez.body.success).toBe(false);
    expect(resSegundaVez.body.error).toBe('TRANSICION_INVALIDA');

    const insumoCafe = await dbLocal('insumos').where({ id: 1 }).first();
    const insumoLeche = await dbLocal('insumos').where({ id: 2 }).first();

    expect(Number(insumoCafe.cantidad_disponible)).toBeCloseTo(0.96, 2);
    expect(Number(insumoLeche.cantidad_disponible)).toBeCloseTo(1.6, 2);
  });

  it('rechaza completar pedidos que no esten en estado en_empaque o que sean inexistentes', async () => {
    await dbLocal('pedidos').insert({
      id: 'PED-PENDIENTE-01',
      cliente: 'Lucía',
      total: 1500.0,
      estado: 'pendiente',
      tipo_pedido: 'salon',
      created_at: '2026-11-01 12:00:00'
    });

    const resPendiente = await request(app).patch('/api/comandas/PED-PENDIENTE-01/completar');
    expect(resPendiente.status).toBe(409);
    expect(resPendiente.body.error).toBe('TRANSICION_INVALIDA');

    const resInexistente = await request(app).patch('/api/comandas/PED-NO-EXISTE/completar');
    expect(resInexistente.status).toBe(404);
    expect(resInexistente.body.error).toBe('NO_ENCONTRADO');
  });

  it('descuenta stock_actual directamente para productos sin receta', async () => {
    await dbLocal('pedidos').insert({
      id: 'PED-SINRECETA-01',
      cliente: 'Tomas',
      total: 1600.0,
      estado: 'en_empaque',
      tipo_pedido: 'take_away',
      created_at: '2026-11-01 13:00:00'
    });

    await dbLocal('detalles_pedidos').insert({
      id: 'DET-SINRECETA-01',
      pedido_id: 'PED-SINRECETA-01',
      producto_id: 2,
      nombre_producto: 'Alfajor Artesanal',
      cantidad: 2,
      precio_venta: 800.0,
      precio_costo: 300.0
    });

    const res = await request(app).patch('/api/comandas/PED-SINRECETA-01/completar');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const producto = await dbLocal('productos').where({ id: 2 }).first();
    expect(producto.stock_actual).toBe(3);
  });
});
