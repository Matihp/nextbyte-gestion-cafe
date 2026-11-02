const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');
const { validarMerma, puedeDescontar } = require('../src/dtos/merma.dto');

describe('Pruebas unitarias del módulo Mermas', () => {
  describe('puedeDescontar', () => {
    it('devuelve true si el stock actual es mayor o igual a la cantidad', () => {
      expect(puedeDescontar(10, 5)).toBe(true);
      expect(puedeDescontar(5, 5)).toBe(true);
      expect(puedeDescontar('10', '5')).toBe(true);
    });

    it('devuelve false si la cantidad supera el stock actual', () => {
      expect(puedeDescontar(4, 5)).toBe(false);
      expect(puedeDescontar(0, 1)).toBe(false);
    });

    it('devuelve false si la cantidad es menor o igual a cero', () => {
      expect(puedeDescontar(10, 0)).toBe(false);
      expect(puedeDescontar(10, -3)).toBe(false);
    });

    it('devuelve false ante entradas no numéricas', () => {
      expect(puedeDescontar('invalido', 5)).toBe(false);
      expect(puedeDescontar(10, 'invalido')).toBe(false);
    });
  });

  describe('validarMerma', () => {
    it('acepta un body válido con fecha', () => {
      const body = {
        producto_id: 1,
        cantidad: 2,
        motivo: 'Vencimiento',
        fecha: '2026-10-31',
      };
      expect(validarMerma(body)).toEqual([]);
    });

    it('acepta un body válido sin fecha (se asignará la de hoy por defecto)', () => {
      const body = {
        producto_id: 2,
        cantidad: 1,
        motivo: 'Rotura durante manipulación',
      };
      expect(validarMerma(body)).toEqual([]);
    });

    it('rechaza si falta o es inválido producto_id', () => {
      expect(validarMerma({ cantidad: 1, motivo: 'Falla' })).toContain(
        'producto_id debe ser un número entero mayor a 0'
      );
      expect(validarMerma({ producto_id: 0, cantidad: 1, motivo: 'Falla' })).toContain(
        'producto_id debe ser un número entero mayor a 0'
      );
      expect(validarMerma({ producto_id: -2, cantidad: 1, motivo: 'Falla' })).toContain(
        'producto_id debe ser un número entero mayor a 0'
      );
      expect(validarMerma({ producto_id: 'abc', cantidad: 1, motivo: 'Falla' })).toContain(
        'producto_id debe ser un número entero mayor a 0'
      );
    });

    it('rechaza si la cantidad no es un entero mayor a cero', () => {
      expect(validarMerma({ producto_id: 1, cantidad: 0, motivo: 'Falla' })).toContain(
        'cantidad debe ser un número entero mayor a 0'
      );
      expect(validarMerma({ producto_id: 1, cantidad: -1, motivo: 'Falla' })).toContain(
        'cantidad debe ser un número entero mayor a 0'
      );
      expect(validarMerma({ producto_id: 1, cantidad: 1.5, motivo: 'Falla' })).toContain(
        'cantidad debe ser un número entero mayor a 0'
      );
    });

    it('rechaza si falta el motivo o está vacío', () => {
      expect(validarMerma({ producto_id: 1, cantidad: 1, motivo: '   ' })).toContain(
        'El motivo es obligatorio'
      );
      expect(validarMerma({ producto_id: 1, cantidad: 1 })).toContain(
        'El motivo es obligatorio'
      );
    });

    it('rechaza si la fecha no tiene formato YYYY-MM-DD válido', () => {
      const body = {
        producto_id: 1,
        cantidad: 1,
        motivo: 'Defecto',
        fecha: '31-10-2026',
      };
      expect(validarMerma(body)).toContain('fecha debe tener formato YYYY-MM-DD');
    });
  });
});

describe('Pruebas de integración - API /api/mermas', () => {
  let categoriaId;
  let productoId;
  let productoSinStockId;

  beforeAll(async () => {
    await resetDb();

    const [catId] = await dbLocal('categorias').insert({
      nombre: 'Pastelería',
      icono: 'cake',
    });
    categoriaId = catId;

    const [prodId] = await dbLocal('productos').insert({
      categoria_id: categoriaId,
      nombre: 'Medialuna de Manteca',
      precio_venta: 800,
      stock_actual: 20,
    });
    productoId = prodId;

    const [prodSinStock] = await dbLocal('productos').insert({
      categoria_id: categoriaId,
      nombre: 'Torta Red Velvet',
      precio_venta: 4500,
      stock_actual: 0,
    });
    productoSinStockId = prodSinStock;
  });

  afterAll(async () => {
    await closeDb();
  });

  let mermaCreadaId;

  it('POST /api/mermas registra una merma, descuenta stock del producto y completa nombres', async () => {
    const respuesta = await request(app)
      .post('/api/mermas')
      .send({
        producto_id: productoId,
        cantidad: 5,
        motivo: 'Elaboración defectuosa / quemada',
        fecha: '2026-10-31',
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.id).toBeDefined();
    expect(respuesta.body.data.producto_id).toBe(productoId);
    expect(respuesta.body.data.cantidad).toBe(5);
    expect(respuesta.body.data.motivo).toBe('Elaboración defectuosa / quemada');
    expect(respuesta.body.data.nombre_producto).toBe('Medialuna de Manteca');
    expect(respuesta.body.data.nombre_categoria).toBe('Pastelería');

    mermaCreadaId = respuesta.body.data.id;

    const productoEnDb = await dbLocal('productos').where({ id: productoId }).first();
    expect(productoEnDb.stock_actual).toBe(15);
  });

  it('POST /api/mermas responde 409 si la cantidad supera el stock actual y no descuenta nada', async () => {
    const respuesta = await request(app)
      .post('/api/mermas')
      .send({
        producto_id: productoId,
        cantidad: 100,
        motivo: 'Caída accidental de bandeja',
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('STOCK_INSUFICIENTE');
    expect(respuesta.body.message).toContain('No hay stock suficiente para registrar la merma');

    const productoEnDb = await dbLocal('productos').where({ id: productoId }).first();
    expect(productoEnDb.stock_actual).toBe(15);
  });

  it('POST /api/mermas responde 409 si el producto tiene stock 0', async () => {
    const respuesta = await request(app)
      .post('/api/mermas')
      .send({
        producto_id: productoSinStockId,
        cantidad: 1,
        motivo: 'Vencimiento',
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toBe('STOCK_INSUFICIENTE');
  });

  it('POST /api/mermas responde 404 si el producto no existe', async () => {
    const respuesta = await request(app)
      .post('/api/mermas')
      .send({
        producto_id: 999999,
        cantidad: 2,
        motivo: 'Producto inexistente',
      });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('NO_ENCONTRADO');
    expect(respuesta.body.message).toContain('Producto no encontrado');
  });

  it('GET /api/mermas lista las mermas y permite filtrar', async () => {
    const respuesta = await request(app).get('/api/mermas');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(Array.isArray(respuesta.body.data)).toBe(true);
    expect(respuesta.body.data.length).toBeGreaterThanOrEqual(1);

    const filtrado = await request(app).get(`/api/mermas?producto_id=${productoId}`);
    expect(filtrado.status).toBe(200);
    expect(filtrado.body.data.every((m) => m.producto_id === productoId)).toBe(true);

    const filtradoInexistente = await request(app).get('/api/mermas?producto_id=888888');
    expect(filtradoInexistente.status).toBe(200);
    expect(filtradoInexistente.body.data).toHaveLength(0);
  });

  it('DELETE /api/mermas/:id elimina la merma y devuelve el stock al producto', async () => {
    const respuesta = await request(app).delete(`/api/mermas/${mermaCreadaId}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.id).toBe(mermaCreadaId);

    const productoEnDb = await dbLocal('productos').where({ id: productoId }).first();
    expect(productoEnDb.stock_actual).toBe(20);

    const mermaEnDb = await dbLocal('registros_mermas').where({ id: mermaCreadaId }).first();
    expect(mermaEnDb).toBeUndefined();
  });

  it('DELETE /api/mermas/:id responde 404 si la merma no existe', async () => {
    const respuesta = await request(app).delete('/api/mermas/id-merma-inexistente');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('NO_ENCONTRADO');
  });
});

