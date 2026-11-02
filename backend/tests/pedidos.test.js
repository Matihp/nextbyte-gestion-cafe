const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const {
  generarIdPedido,
  calcularTotal,
  calcularCostoUnitario
} = require('../src/services/pedidoService');
const { validarPedido } = require('../src/dtos/pedido.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Funciones puras de pedidos', () => {
  it('generarIdPedido genera un identificador con prefijo PED- y 8 caracteres hexadecimales en mayuscula', () => {
    const id = generarIdPedido();
    expect(id).toMatch(/^PED-[0-9A-F]{8}$/);

    const otroId = generarIdPedido();
    expect(id).not.toBe(otroId);
  });

  it('calcularTotal suma cantidades por precios unitarios y redondea a dos decimales', () => {
    const items = [
      { cantidad: 3, precio_venta: 1250.55 },
      { cantidad: 2, precio_venta: 340.25 }
    ];
    const total = calcularTotal(items);
    expect(total).toBe(4432.15);

    expect(calcularTotal([])).toBe(0);
  });

  it('calcularCostoUnitario calcula la suma de costos de ingredientes con redondeo', () => {
    const ingredientes = [
      { cantidad: 0.025, precio_costo: 80.0 },
      { cantidad: 0.15, precio_costo: 30.0 }
    ];
    const costo = calcularCostoUnitario(ingredientes);
    expect(costo).toBe(6.5);

    expect(calcularCostoUnitario([])).toBe(0);
  });

  it('validarPedido detecta items vacios, cantidad cero y delivery sin direccion o telefono', () => {
    const errorVacio = validarPedido({
      tipo_pedido: 'salon',
      metodo_pago: 'efectivo',
      items: []
    });
    expect(errorVacio).toContain('El pedido debe contener al menos un ítem');

    const errorCantidad = validarPedido({
      tipo_pedido: 'salon',
      metodo_pago: 'efectivo',
      items: [{ producto_id: 1, cantidad: 0 }]
    });
    expect(errorCantidad).toContain('La cantidad de cada ítem debe ser un entero mayor a cero');

    const errorDelivery = validarPedido({
      tipo_pedido: 'delivery',
      metodo_pago: 'efectivo',
      items: [{ producto_id: 1, cantidad: 1 }]
    });
    expect(errorDelivery).toContain('La dirección es obligatoria para pedidos de delivery');
    expect(errorDelivery).toContain('El teléfono es obligatorio para pedidos de delivery');

    const errorRepetido = validarPedido({
      tipo_pedido: 'salon',
      metodo_pago: 'efectivo',
      items: [
        { producto_id: 1, cantidad: 1 },
        { producto_id: 1, cantidad: 2 }
      ]
    });
    expect(errorRepetido).toContain('No se puede repetir el mismo producto en los ítems del pedido');
  });
});

describe('Integración endpoints de pedidos', () => {
  const authOriginal = process.env.AUTH_ENABLED;
  const jwtOriginal = process.env.JWT_SECRET;
  let token;

  beforeAll(async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.JWT_SECRET = 'secreto_pedidos_test';
    await resetDb();

    await dbLocal('roles').insert({
      id: 'ROL-PEDIDOS-01',
      nombre: 'Cajero',
      es_admin: 1,
      permisos: JSON.stringify(['all'])
    });

    const hash = await bcrypt.hash('clave123', 10);
    await dbLocal('empleados').insert({
      id: 'EMP-PEDIDOS-01',
      rol_id: 'ROL-PEDIDOS-01',
      legajo: 'LEG-PED',
      nombre: 'Ana',
      apellido: 'Ruiz',
      email: 'ana@nextbyte.com',
      contrasena: hash,
      permisos: JSON.stringify(['all'])
    });

    await dbLocal('categorias').insert({
      id: 1,
      nombre: 'Bebidas Calientes'
    });

    await dbLocal('insumos').insert([
      {
        id: 1,
        nombre: 'Cafe Grano',
        rubro: 'Cafeteria',
        cantidad_disponible: 10.0,
        unidad_medida: 'kg',
        stock_minimo: 1.0,
        precio_costo: 80.0
      },
      {
        id: 2,
        nombre: 'Leche',
        rubro: 'Lacteos',
        cantidad_disponible: 20.0,
        unidad_medida: 'lts',
        stock_minimo: 2.0,
        precio_costo: 20.0
      }
    ]);

    await dbLocal('productos').insert([
      {
        id: 1,
        categoria_id: 1,
        nombre: 'Latte Especial',
        precio_venta: 1500.0,
        stock_actual: 50
      },
      {
        id: 2,
        categoria_id: 1,
        nombre: 'Medialuna Dulce',
        precio_venta: 800.0,
        stock_actual: 30
      }
    ]);

    await dbLocal('recetas').insert({
      id: 1,
      producto_id: 1,
      nombre: 'Receta Latte Especial'
    });

    await dbLocal('ingredientes_recetas').insert([
      { receta_id: 1, insumo_id: 1, cantidad: 0.025 },
      { receta_id: 1, insumo_id: 2, cantidad: 0.2 }
    ]);

    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@nextbyte.com', contrasena: 'clave123' });
    token = resLogin.body.data.token;
  });

  afterAll(async () => {
    if (authOriginal === undefined) {
      delete process.env.AUTH_ENABLED;
    } else {
      process.env.AUTH_ENABLED = authOriginal;
    }

    if (jwtOriginal === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = jwtOriginal;
    }

    await closeDb();
  });

  it('POST /api/pedidos crea un pedido ignorando precios falsos enviados en el body y calculando costos', async () => {
    const res = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cliente: 'Gonzalo Gomez',
        tipo_pedido: 'salon',
        metodo_pago: 'efectivo',
        items: [
          { producto_id: 1, cantidad: 2, precio_venta: 1.0 },
          { producto_id: 2, cantidad: 1, precio_venta: 1.0 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const pedido = res.body.data;
    expect(pedido.id).toMatch(/^PED-[0-9A-F]{8}$/);
    expect(pedido.cliente).toBe('Gonzalo Gomez');
    expect(pedido.estado).toBe('pendiente');
    expect(Number(pedido.total)).toBe(3800);
    expect(pedido.detalles.length).toBe(2);

    const detalleLatte = pedido.detalles.find((d) => d.producto_id === 1);
    expect(detalleLatte).toBeDefined();
    expect(Number(detalleLatte.precio_venta)).toBe(1500);
    expect(Number(detalleLatte.precio_costo)).toBe(6.0);

    const detalleMedialuna = pedido.detalles.find((d) => d.producto_id === 2);
    expect(detalleMedialuna).toBeDefined();
    expect(Number(detalleMedialuna.precio_venta)).toBe(800);
    expect(Number(detalleMedialuna.precio_costo)).toBe(0);
  });

  it('GET /api/pedidos lista los pedidos con filtro por estado', async () => {
    const res = await request(app)
      .get('/api/pedidos?estado=pendiente')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/pedidos/:id devuelve el pedido con sus detalles', async () => {
    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo_pedido: 'take_away',
        metodo_pago: 'debito',
        items: [{ producto_id: 2, cantidad: 2 }]
      });

    const id = pedidoCreado.body.data.id;

    const res = await request(app)
      .get(`/api/pedidos/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.detalles.length).toBe(1);
  });

  it('PATCH /api/pedidos/:id/cancelar pasa el pedido a cancelado y rechaza si ya esta cancelado', async () => {
    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo_pedido: 'salon',
        metodo_pago: 'mercadopago',
        items: [{ producto_id: 2, cantidad: 1 }]
      });

    const id = pedidoCreado.body.data.id;

    const resCancelar = await request(app)
      .patch(`/api/pedidos/${id}/cancelar`)
      .set('Authorization', `Bearer ${token}`);

    expect(resCancelar.status).toBe(200);
    expect(resCancelar.body.success).toBe(true);
    expect(resCancelar.body.data.estado).toBe('cancelado');

    const resReintento = await request(app)
      .patch(`/api/pedidos/${id}/cancelar`)
      .set('Authorization', `Bearer ${token}`);

    expect(resReintento.status).toBe(409);
    expect(resReintento.body.success).toBe(false);
  });

  it('DELETE /api/pedidos/:id/items/:detalleId quita un item recalculando el total y cancela si queda vacio', async () => {
    const pedidoCreado = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo_pedido: 'salon',
        metodo_pago: 'credito',
        items: [
          { producto_id: 1, cantidad: 1 },
          { producto_id: 2, cantidad: 1 }
        ]
      });

    const pedidoId = pedidoCreado.body.data.id;
    const detalleLatte = pedidoCreado.body.data.detalles.find((d) => d.producto_id === 1);
    const detalleMedialuna = pedidoCreado.body.data.detalles.find((d) => d.producto_id === 2);

    const resBorrarPrimero = await request(app)
      .delete(`/api/pedidos/${pedidoId}/items/${detalleLatte.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resBorrarPrimero.status).toBe(200);
    expect(resBorrarPrimero.body.success).toBe(true);
    expect(Number(resBorrarPrimero.body.data.total)).toBe(800);
    expect(resBorrarPrimero.body.data.detalles.length).toBe(1);

    const resBorrarSegundo = await request(app)
      .delete(`/api/pedidos/${pedidoId}/items/${detalleMedialuna.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(resBorrarSegundo.status).toBe(200);
    expect(resBorrarSegundo.body.success).toBe(true);
    expect(Number(resBorrarSegundo.body.data.total)).toBe(0);
    expect(resBorrarSegundo.body.data.estado).toBe('cancelado');
    expect(resBorrarSegundo.body.data.detalles.length).toBe(0);
  });
});
