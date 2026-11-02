const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');
const {
  calcularEstadoStock,
  estaPorVencer,
  validarInsumo,
  validarIngreso,
} = require('../src/dtos/insumo.dto');

describe('Pruebas unitarias del módulo Insumos', () => {
  describe('calcularEstadoStock', () => {
    it('devuelve critico cuando cantidad_disponible es menor o igual a stock_minimo', () => {
      expect(calcularEstadoStock({ cantidad_disponible: 5, stock_minimo: 10 })).toBe('critico');
      expect(calcularEstadoStock({ cantidad_disponible: 10, stock_minimo: 10 })).toBe('critico');
      expect(calcularEstadoStock({ cantidad_disponible: 0, stock_minimo: 0 })).toBe('critico');
    });

    it('devuelve bajo cuando cantidad_disponible es mayor a stock_minimo y menor o igual a stock_minimo * 1.5', () => {
      expect(calcularEstadoStock({ cantidad_disponible: 11, stock_minimo: 10 })).toBe('bajo');
      expect(calcularEstadoStock({ cantidad_disponible: 15, stock_minimo: 10 })).toBe('bajo');
    });

    it('devuelve ok cuando cantidad_disponible es mayor a stock_minimo * 1.5', () => {
      expect(calcularEstadoStock({ cantidad_disponible: 15.01, stock_minimo: 10 })).toBe('ok');
      expect(calcularEstadoStock({ cantidad_disponible: 25, stock_minimo: 10 })).toBe('ok');
    });

    it('devuelve ok si el insumo no está definido', () => {
      expect(calcularEstadoStock(null)).toBe('ok');
    });
  });

  describe('estaPorVencer', () => {
    const fechaBase = '2026-10-30';

    it('devuelve true si la fecha de vencimiento es hoy o dentro de los próximos dias configurados', () => {
      expect(estaPorVencer({ fecha_vencimiento: '2026-10-30' }, fechaBase, 7)).toBe(true);
      expect(estaPorVencer({ fecha_vencimiento: '2026-11-04' }, fechaBase, 7)).toBe(true);
      expect(estaPorVencer({ fecha_vencimiento: '2026-11-06' }, fechaBase, 7)).toBe(true);
    });

    it('devuelve false si la fecha de vencimiento supera los dias configurados', () => {
      expect(estaPorVencer({ fecha_vencimiento: '2026-11-07' }, fechaBase, 7)).toBe(false);
      expect(estaPorVencer({ fecha_vencimiento: '2026-12-01' }, fechaBase, 7)).toBe(false);
    });

    it('devuelve false si el producto ya venció antes de la fecha de referencia', () => {
      expect(estaPorVencer({ fecha_vencimiento: '2026-10-25' }, fechaBase, 7)).toBe(false);
    });

    it('devuelve false si el insumo no tiene fecha de vencimiento', () => {
      expect(estaPorVencer({}, fechaBase, 7)).toBe(false);
      expect(estaPorVencer(null, fechaBase, 7)).toBe(false);
    });
  });

  describe('validarInsumo', () => {
    it('acepta un insumo con todos los campos válidos', () => {
      const body = {
        nombre: 'Café Brasil Santos',
        rubro: 'Cafetería',
        cantidad_disponible: 20,
        unidad_medida: 'kg',
        stock_minimo: 5,
        precio_costo: 6500,
        fecha_ingreso: '2026-10-30',
        fecha_vencimiento: '2026-12-31',
      };
      expect(validarInsumo(body)).toEqual([]);
    });

    it('rechaza si falta el nombre', () => {
      const body = {
        cantidad_disponible: 10,
        unidad_medida: 'kg',
        stock_minimo: 2,
        precio_costo: 1000,
      };
      const errores = validarInsumo(body);
      expect(errores).toContain('El nombre es obligatorio');
    });

    it('rechaza valores negativos en cantidades y precio', () => {
      const body = {
        nombre: 'Azúcar',
        cantidad_disponible: -1,
        unidad_medida: 'kg',
        stock_minimo: -5,
        precio_costo: 0,
      };
      const errores = validarInsumo(body);
      expect(errores).toContain('cantidad_disponible debe ser un número mayor o igual a 0');
      expect(errores).toContain('stock_minimo debe ser un número mayor o igual a 0');
      expect(errores).toContain('precio_costo debe ser un número mayor a 0');
    });

    it('rechaza unidades de medida no permitidas', () => {
      const body = {
        nombre: 'Cacao',
        cantidad_disponible: 10,
        unidad_medida: 'gramos',
        stock_minimo: 2,
        precio_costo: 500,
      };
      const errores = validarInsumo(body);
      expect(errores.some((e) => e.includes('unidad_medida debe ser una de las siguientes'))).toBe(true);
    });

    it('rechaza si la fecha de vencimiento es anterior a la de ingreso', () => {
      const body = {
        nombre: 'Leche',
        cantidad_disponible: 10,
        unidad_medida: 'lts',
        stock_minimo: 2,
        precio_costo: 1000,
        fecha_ingreso: '2026-10-30',
        fecha_vencimiento: '2026-10-20',
      };
      const errores = validarInsumo(body);
      expect(errores).toContain('La fecha de vencimiento no puede ser anterior a la fecha de ingreso');
    });
  });

  describe('validarIngreso', () => {
    it('acepta una cantidad numérica positiva', () => {
      expect(validarIngreso({ cantidad: 15 })).toEqual([]);
      expect(validarIngreso({ cantidad: '10' })).toEqual([]);
    });

    it('rechaza cantidades menores o iguales a cero o no numéricas', () => {
      expect(validarIngreso({ cantidad: 0 })).toContain('La cantidad debe ser un número mayor a 0');
      expect(validarIngreso({ cantidad: -5 })).toContain('La cantidad debe ser un número mayor a 0');
      expect(validarIngreso({ cantidad: 'invalido' })).toContain('La cantidad debe ser un número mayor a 0');
    });
  });
});

describe('Pruebas de integración - API /api/insumos', () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  let insumoCreadoId;
  let insumoCriticoId;

  it('POST /api/insumos crea un insumo y responde 201 con estado_stock y por_vencer', async () => {
    const respuesta = await request(app)
      .post('/api/insumos')
      .send({
        nombre: 'Café Colombia Supremo',
        rubro: 'Cafetería',
        cantidad_disponible: 30,
        unidad_medida: 'kg',
        stock_minimo: 10,
        precio_costo: 7200,
        fecha_ingreso: '2026-10-30',
        fecha_vencimiento: '2026-12-15',
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.id).toBeDefined();
    expect(respuesta.body.data.nombre).toBe('Café Colombia Supremo');
    expect(respuesta.body.data.estado_stock).toBe('ok');
    expect(typeof respuesta.body.data.por_vencer).toBe('boolean');
    expect(respuesta.body.data.ultima_actualizacion).toBeDefined();

    insumoCreadoId = respuesta.body.data.id;
  });

  it('POST /api/insumos responde 409 si el nombre del insumo ya existe', async () => {
    const respuesta = await request(app)
      .post('/api/insumos')
      .send({
        nombre: 'Café Colombia Supremo',
        cantidad_disponible: 10,
        unidad_medida: 'kg',
        stock_minimo: 2,
        precio_costo: 5000,
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('DUPLICADO');
    expect(respuesta.body.message).toContain('Ya existe un insumo con ese nombre');
  });

  it('GET /api/insumos lista los insumos ordenados por nombre', async () => {
    const resCritico = await request(app)
      .post('/api/insumos')
      .send({
        nombre: 'Canela en Polvo',
        rubro: 'Especias',
        cantidad_disponible: 1,
        unidad_medida: 'kg',
        stock_minimo: 5,
        precio_costo: 1800,
      });
    expect(resCritico.status).toBe(201);
    insumoCriticoId = resCritico.body.data.id;

    const respuesta = await request(app).get('/api/insumos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(Array.isArray(respuesta.body.data)).toBe(true);
    expect(respuesta.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/insumos/alertas devuelve únicamente los insumos críticos o bajos', async () => {
    const respuesta = await request(app).get('/api/insumos/alertas');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(Array.isArray(respuesta.body.data)).toBe(true);

    const estados = respuesta.body.data.map((i) => i.estado_stock);
    expect(estados.every((e) => e === 'critico' || e === 'bajo')).toBe(true);
    expect(respuesta.body.data.some((i) => i.id === insumoCriticoId)).toBe(true);
    expect(respuesta.body.data.some((i) => i.id === insumoCreadoId)).toBe(false);
  });

  it('GET /api/insumos/:id devuelve un insumo existente y 404 si no existe', async () => {
    const respuestaOk = await request(app).get(`/api/insumos/${insumoCreadoId}`);
    expect(respuestaOk.status).toBe(200);
    expect(respuestaOk.body.data.id).toBe(insumoCreadoId);
    expect(respuestaOk.body.data.estado_stock).toBe('ok');

    const respuesta404 = await request(app).get('/api/insumos/999999');
    expect(respuesta404.status).toBe(404);
    expect(respuesta404.body.error).toBe('NO_ENCONTRADO');
  });

  it('PUT /api/insumos/:id edita un insumo existente', async () => {
    const respuesta = await request(app)
      .put(`/api/insumos/${insumoCreadoId}`)
      .send({
        nombre: 'Café Colombia Supremo Modificado',
        rubro: 'Cafetería Especial',
        cantidad_disponible: 35,
        unidad_medida: 'kg',
        stock_minimo: 10,
        precio_costo: 7500,
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.nombre).toBe('Café Colombia Supremo Modificado');
    expect(respuesta.body.data.precio_costo).toBe(7500);
  });

  it('PATCH /api/insumos/:id/ingreso suma stock correctamente', async () => {
    const antes = await request(app).get(`/api/insumos/${insumoCreadoId}`);
    const cantidadAnterior = Number(antes.body.data.cantidad_disponible);

    const respuesta = await request(app)
      .patch(`/api/insumos/${insumoCreadoId}/ingreso`)
      .send({ cantidad: 15 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(Number(respuesta.body.data.cantidad_disponible)).toBe(cantidadAnterior + 15);
  });

  it('PATCH /api/insumos/:id/ingreso responde 400 si la cantidad enviada es menor o igual a 0', async () => {
    const respuesta = await request(app)
      .patch(`/api/insumos/${insumoCreadoId}/ingreso`)
      .send({ cantidad: 0 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('VALIDACION');
  });

  it('DELETE /api/insumos/:id responde 409 si el insumo se usa en una receta', async () => {
    const resInsumoReceta = await request(app)
      .post('/api/insumos')
      .send({
        nombre: 'Chocolate en Polvo para Receta',
        cantidad_disponible: 10,
        unidad_medida: 'kg',
        stock_minimo: 2,
        precio_costo: 3000,
      });
    const idInsumoReceta = resInsumoReceta.body.data.id;

    const [idCat] = await dbLocal('categorias').insert({ nombre: 'Bebidas Calientes' });
    const [idProd] = await dbLocal('productos').insert({
      categoria_id: idCat,
      nombre: 'Submarino Especial',
      precio_venta: 2500,
      stock_actual: 10,
    });
    const [idReceta] = await dbLocal('recetas').insert({
      producto_id: idProd,
      nombre: 'Receta Submarino Especial',
    });
    await dbLocal('ingredientes_recetas').insert({
      receta_id: idReceta,
      insumo_id: idInsumoReceta,
      cantidad: 0.05,
    });

    const respuestaBorrado = await request(app).delete(`/api/insumos/${idInsumoReceta}`);
    expect(respuestaBorrado.status).toBe(409);
    expect(respuestaBorrado.body.success).toBe(false);
    expect(respuestaBorrado.body.error).toBe('RELACION');
    expect(respuestaBorrado.body.message).toContain('No se puede eliminar: el insumo se usa en recetas');
  });

  it('DELETE /api/insumos/:id borra un insumo asignado a un proveedor y lo remueve del proveedor', async () => {
    const resInsumo = await request(app)
      .post('/api/insumos')
      .send({
        nombre: 'Vainilla Natural en Chaucha',
        cantidad_disponible: 2,
        unidad_medida: 'un',
        stock_minimo: 1,
        precio_costo: 1500,
      });
    const idInsumo = resInsumo.body.data.id;

    const resProveedor = await request(app)
      .post('/api/proveedores')
      .send({
        codigo: 'PROV-VAINILLA',
        empresa: 'Importadora Vainillas SA',
        insumos_asignados_ids: [idInsumo],
      });
    expect(resProveedor.status).toBe(201);
    const idProveedor = resProveedor.body.data.id;

    const resBorrado = await request(app).delete(`/api/insumos/${idInsumo}`);
    expect(resBorrado.status).toBe(200);
    expect(resBorrado.body.success).toBe(true);

    const provActualizado = await request(app).get(`/api/proveedores/${idProveedor}`);
    expect(provActualizado.status).toBe(200);
    expect(provActualizado.body.data.insumos_asignados_ids).not.toContain(idInsumo);
  });

  it('DELETE /api/insumos/:id responde 404 si el insumo no existe', async () => {
    const respuesta = await request(app).delete('/api/insumos/999999');
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error).toBe('NO_ENCONTRADO');
  });
});

