const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');
const { validarRangoFechas } = require('../src/dtos/reporte.dto');
const { calcularGanancia, rangoMesActual } = require('../src/services/reporteService');

describe('Pruebas unitarias de reportes', () => {
  describe('calcularGanancia', () => {
    it('calcula ganancia y margen correctamente en un caso normal', () => {
      const resultado = calcularGanancia(1000, 600);
      expect(resultado).toEqual({
        ganancia: 400,
        margen_porcentaje: 40
      });
    });

    it('devuelve ganancia y margen en cero cuando las ventas son cero', () => {
      const resultado = calcularGanancia(0, 0);
      expect(resultado).toEqual({
        ganancia: 0,
        margen_porcentaje: 0
      });
    });

    it('maneja ventas en cero con costos existentes sin dividir por cero', () => {
      const resultado = calcularGanancia(0, 150);
      expect(resultado).toEqual({
        ganancia: -150,
        margen_porcentaje: 0
      });
    });

    it('calcula ganancia y margen negativos cuando el costo supera a la venta', () => {
      const resultado = calcularGanancia(500, 750);
      expect(resultado).toEqual({
        ganancia: -250,
        margen_porcentaje: -50
      });
    });
  });

  describe('validarRangoFechas', () => {
    it('retorna array vacio cuando el rango de fechas es valido', () => {
      const errores = validarRangoFechas('2026-10-01', '2026-10-31');
      expect(errores).toEqual([]);
    });

    it('rechaza si la fecha desde es posterior a la fecha hasta', () => {
      const errores = validarRangoFechas('2026-10-25', '2026-10-10');
      expect(errores).toContain('La fecha "desde" no puede ser posterior a "hasta"');
    });

    it('rechaza si la fecha desde tiene un formato invalido', () => {
      const errores = validarRangoFechas('2026-13-45', '2026-10-31');
      expect(errores).toContain('La fecha "desde" no es válida (formato requerido: YYYY-MM-DD)');
    });

    it('rechaza si la fecha hasta tiene un formato invalido', () => {
      const errores = validarRangoFechas('2026-10-01', 'texto-invalido');
      expect(errores).toContain('La fecha "hasta" no es válida (formato requerido: YYYY-MM-DD)');
    });
  });

  describe('rangoMesActual', () => {
    it('retorna el primer y ultimo dia del mes de la fecha indicada', () => {
      const rango = rangoMesActual('2026-10-15');
      expect(rango).toEqual({
        desde: '2026-10-01',
        hasta: '2026-10-31'
      });
    });

    it('calcula correctamente el ultimo dia para febrero en anio bisiesto', () => {
      const rango = rangoMesActual('2024-02-10');
      expect(rango).toEqual({
        desde: '2024-02-01',
        hasta: '2024-02-29'
      });
    });
  });
});

describe('Pruebas de integracion - API /api/reportes', () => {
  beforeAll(async () => {
    await resetDb();

    const [catId] = await dbLocal('categorias').insert({
      nombre: 'Cafeteria',
      icono: 'coffee'
    });

    const [idProductoCafe] = await dbLocal('productos').insert({
      categoria_id: catId,
      nombre: 'Cafe Espresso',
      precio_venta: 1500,
      stock_actual: 50
    });

    const [idProductoMedialuna] = await dbLocal('productos').insert({
      categoria_id: catId,
      nombre: 'Medialuna de Manteca',
      precio_venta: 800,
      stock_actual: 30
    });

    const [idProductoSubmarino] = await dbLocal('productos').insert({
      categoria_id: catId,
      nombre: 'Submarino Especial',
      precio_venta: 2000,
      stock_actual: 20
    });

    await dbLocal('pedidos').insert([
      {
        id: 'PED-REP-001',
        cliente: 'Cliente Uno',
        total: 3000,
        estado: 'completado',
        tipo_pedido: 'salon',
        fecha: '2026-10-10',
        hora: '10:00:00'
      },
      {
        id: 'PED-REP-002',
        cliente: 'Cliente Dos',
        total: 800,
        estado: 'completado',
        tipo_pedido: 'take_away',
        fecha: '2026-10-10',
        hora: '11:00:00'
      },
      {
        id: 'PED-REP-003',
        cliente: 'Cliente Tres',
        total: 4500,
        estado: 'completado',
        tipo_pedido: 'delivery',
        fecha: '2026-10-15',
        hora: '15:30:00'
      },
      {
        id: 'PED-REP-CANCEL',
        cliente: 'Cliente Cancelado',
        total: 10000,
        estado: 'cancelado',
        tipo_pedido: 'salon',
        fecha: '2026-10-15',
        hora: '16:00:00'
      },
      {
        id: 'PED-REP-ACT-1',
        cliente: 'Activo Pendiente',
        total: 1500,
        estado: 'pendiente',
        tipo_pedido: 'salon',
        fecha: '2026-10-31',
        hora: '18:00:00'
      },
      {
        id: 'PED-REP-ACT-2',
        cliente: 'Activo Preparacion',
        total: 2000,
        estado: 'en_preparacion',
        tipo_pedido: 'salon',
        fecha: '2026-10-31',
        hora: '18:05:00'
      },
      {
        id: 'PED-REP-ACT-3',
        cliente: 'Activo Empaque',
        total: 800,
        estado: 'en_empaque',
        tipo_pedido: 'take_away',
        fecha: '2026-10-31',
        hora: '18:10:00'
      }
    ]);

    await dbLocal('detalles_pedidos').insert([
      {
        id: 'DET-001',
        pedido_id: 'PED-REP-001',
        producto_id: idProductoCafe,
        nombre_producto: 'Cafe Espresso',
        cantidad: 2,
        precio_venta: 1500,
        precio_costo: 600
      },
      {
        id: 'DET-002',
        pedido_id: 'PED-REP-002',
        producto_id: idProductoMedialuna,
        nombre_producto: 'Medialuna de Manteca',
        cantidad: 1,
        precio_venta: 800,
        precio_costo: 300
      },
      {
        id: 'DET-003',
        pedido_id: 'PED-REP-003',
        producto_id: idProductoCafe,
        nombre_producto: 'Cafe Espresso',
        cantidad: 3,
        precio_venta: 1500,
        precio_costo: 600
      },
      {
        id: 'DET-CANCEL',
        pedido_id: 'PED-REP-CANCEL',
        producto_id: idProductoSubmarino,
        nombre_producto: 'Submarino Especial',
        cantidad: 5,
        precio_venta: 2000,
        precio_costo: 1000
      }
    ]);

    await dbLocal('registro_ventas').insert([
      {
        id: 'RV-001',
        pedido_id: 'PED-REP-001',
        fecha: '2026-10-10',
        total_venta: 3000,
        total_costo: 1200
      },
      {
        id: 'RV-002',
        pedido_id: 'PED-REP-002',
        fecha: '2026-10-10',
        total_venta: 800,
        total_costo: 300
      },
      {
        id: 'RV-003',
        pedido_id: 'PED-REP-003',
        fecha: '2026-10-15',
        total_venta: 4500,
        total_costo: 1800
      },
      {
        id: 'RV-CANCEL',
        pedido_id: 'PED-REP-CANCEL',
        fecha: '2026-10-15',
        total_venta: 10000,
        total_costo: 5000
      }
    ]);

    await dbLocal('insumos').insert([
      {
        nombre: 'Granos de Cafe',
        rubro: 'Cafeteria',
        cantidad_disponible: 5,
        stock_minimo: 10,
        precio_costo: 5000,
        unidad_medida: 'kg'
      },
      {
        nombre: 'Leche Entera',
        rubro: 'Lacteos',
        cantidad_disponible: 25,
        stock_minimo: 20,
        precio_costo: 1200,
        unidad_medida: 'lts'
      },
      {
        nombre: 'Esencia de Vainilla',
        rubro: 'Almacen',
        cantidad_disponible: 2,
        stock_minimo: 2,
        precio_costo: 800,
        unidad_medida: 'un'
      }
    ]);

    await dbLocal('registros_mermas').insert([
      {
        id: 'MER-001',
        producto_id: idProductoMedialuna,
        nombre_producto: 'Medialuna de Manteca',
        nombre_categoria: 'Cafeteria',
        motivo: 'Vencimiento',
        fecha: '2026-10-12',
        cantidad: 3
      },
      {
        id: 'MER-002',
        producto_id: idProductoMedialuna,
        nombre_producto: 'Medialuna de Manteca',
        nombre_categoria: 'Cafeteria',
        motivo: 'Vencimiento',
        fecha: '2026-10-13',
        cantidad: 2
      },
      {
        id: 'MER-003',
        producto_id: idProductoCafe,
        nombre_producto: 'Cafe Espresso',
        nombre_categoria: 'Cafeteria',
        motivo: 'Derrame',
        fecha: '2026-10-14',
        cantidad: 1
      }
    ]);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('GET /api/reportes/ventas-dia devuelve las ventas consolidadas del dia', async () => {
    const res = await request(app).get('/api/reportes/ventas-dia?fecha=2026-10-10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      fecha: '2026-10-10',
      cantidad_pedidos: 2,
      total_venta: 3800,
      total_costo: 1500,
      ganancia: 2300
    });
  });

  it('GET /api/reportes/ventas-dia devuelve ceros sin error cuando no hay ventas', async () => {
    const res = await request(app).get('/api/reportes/ventas-dia?fecha=2026-10-01');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      fecha: '2026-10-01',
      cantidad_pedidos: 0,
      total_venta: 0,
      total_costo: 0,
      ganancia: 0
    });
  });

  it('GET /api/reportes/ventas-dia responde 400 ante una fecha invalida', async () => {
    const res = await request(app).get('/api/reportes/ventas-dia?fecha=invalida');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/reportes/ventas-rango agrupa dias con ventas y omite cancelados', async () => {
    const res = await request(app).get('/api/reportes/ventas-rango?desde=2026-10-01&hasta=2026-10-20');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);

    expect(res.body.data[0]).toEqual({
      fecha: '2026-10-10',
      cantidad_pedidos: 2,
      total_venta: 3800,
      total_costo: 1500,
      ganancia: 2300
    });

    expect(res.body.data[1]).toEqual({
      fecha: '2026-10-15',
      cantidad_pedidos: 1,
      total_venta: 4500,
      total_costo: 1800,
      ganancia: 2700
    });
  });

  it('GET /api/reportes/ventas-rango responde 400 si desde es mayor a hasta', async () => {
    const res = await request(app).get('/api/reportes/ventas-rango?desde=2026-10-20&hasta=2026-10-10');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/reportes/top-productos devuelve los mas vendidos respetando orden y sin pedidos cancelados', async () => {
    const res = await request(app).get('/api/reportes/top-productos?desde=2026-10-01&hasta=2026-10-20&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    expect(res.body.data[0].nombre_producto).toBe('Cafe Espresso');
    expect(res.body.data[0].unidades).toBe(5);
    expect(res.body.data[0].ingresos).toBe(7500);

    expect(res.body.data[1].nombre_producto).toBe('Medialuna de Manteca');
    expect(res.body.data[1].unidades).toBe(1);
    expect(res.body.data[1].ingresos).toBe(800);
  });

  it('GET /api/reportes/top-productos respeta el parametro limit', async () => {
    const res = await request(app).get('/api/reportes/top-productos?desde=2026-10-01&hasta=2026-10-20&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nombre_producto).toBe('Cafe Espresso');
  });

  it('GET /api/reportes/top-productos responde 400 ante un limite fuera de rango', async () => {
    const res = await request(app).get('/api/reportes/top-productos?limit=0');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/reportes/ganancias calcula total venta, costo, ganancia y margen porcentual', async () => {
    const res = await request(app).get('/api/reportes/ganancias?desde=2026-10-01&hasta=2026-10-20');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      total_venta: 8300,
      total_costo: 3300,
      ganancia: 5000,
      margen_porcentaje: 60.24
    });
  });

  it('GET /api/reportes/ganancias devuelve ceros en periodo sin ventas', async () => {
    const res = await request(app).get('/api/reportes/ganancias?desde=2026-12-01&hasta=2026-12-31');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      total_venta: 0,
      total_costo: 0,
      ganancia: 0,
      margen_porcentaje: 0
    });
  });

  it('GET /api/reportes/mermas agrupa por producto y motivo', async () => {
    const res = await request(app).get('/api/reportes/mermas?desde=2026-10-01&hasta=2026-10-20');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      {
        producto_id: expect.any(Number),
        nombre_producto: 'Cafe Espresso',
        motivo: 'Derrame',
        cantidad_total: 1
      },
      {
        producto_id: expect.any(Number),
        nombre_producto: 'Medialuna de Manteca',
        motivo: 'Vencimiento',
        cantidad_total: 5
      }
    ]);
  });

  it('GET /api/reportes/resumen consolida los indicadores clave del panel', async () => {
    const res = await request(app).get('/api/reportes/resumen');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ventas_hoy).toBeDefined();
    expect(res.body.data.cantidad_pedidos_hoy).toBeDefined();
    expect(res.body.data.pedidos_activos).toBe(3);
    expect(res.body.data.insumos_en_alerta).toBe(2);
    expect(
      res.body.data.producto_mas_vendido_mes === null ||
      typeof res.body.data.producto_mas_vendido_mes.nombre_producto === 'string'
    ).toBe(true);
  });
});
