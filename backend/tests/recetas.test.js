const request = require('supertest');
const app = require('../src/app');
const { validarReceta, detectarRepetidos } = require('../src/dtos/receta.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas unitarias de receta.dto', () => {
  describe('detectarRepetidos', () => {
    it('detecta duplicados en lista de ingredientes', () => {
      const conDuplicados = [
        { insumo_id: 1, cantidad: 0.018 },
        { insumo_id: 2, cantidad: 0.2 },
        { insumo_id: 1, cantidad: 0.01 }
      ];
      expect(detectarRepetidos(conDuplicados)).toBe(true);
    });

    it('devuelve false cuando no hay duplicados', () => {
      const sinDuplicados = [
        { insumo_id: 1, cantidad: 0.018 },
        { insumo_id: 2, cantidad: 0.2 }
      ];
      expect(detectarRepetidos(sinDuplicados)).toBe(false);
    });

    it('maneja valores no array o vacios', () => {
      expect(detectarRepetidos(null)).toBe(false);
      expect(detectarRepetidos([])).toBe(false);
    });
  });

  describe('validarReceta', () => {
    it('detecta nombre ausente o vacio', () => {
      const errores = validarReceta({
        nombre: '   ',
        ingredientes: [{ insumo_id: 1, cantidad: 0.5 }]
      });
      expect(errores).toContain('El nombre es obligatorio');
    });

    it('detecta ingredientes ausente, no array o vacio', () => {
      const erroresSinIngredientes = validarReceta({ nombre: 'Receta Café' });
      expect(erroresSinIngredientes).toContain('La receta debe contener al menos un ingrediente');

      const erroresVacio = validarReceta({ nombre: 'Receta Café', ingredientes: [] });
      expect(erroresVacio).toContain('La receta debe contener al menos un ingrediente');
    });

    it('detecta cantidades no numericas, negativas o cero', () => {
      const erroresCero = validarReceta({
        nombre: 'Receta Café',
        ingredientes: [{ insumo_id: 1, cantidad: 0 }]
      });
      expect(erroresCero).toContain('La cantidad del ingrediente 1 debe ser un número mayor a 0');

      const erroresNegativo = validarReceta({
        nombre: 'Receta Café',
        ingredientes: [{ insumo_id: 1, cantidad: -0.5 }]
      });
      expect(erroresNegativo).toContain('La cantidad del ingrediente 1 debe ser un número mayor a 0');
    });

    it('detecta insumos duplicados en la receta', () => {
      const errores = validarReceta({
        nombre: 'Receta Café',
        ingredientes: [
          { insumo_id: 1, cantidad: 0.018 },
          { insumo_id: 1, cantidad: 0.02 }
        ]
      });
      expect(errores).toContain('No se pueden repetir insumos en la misma receta');
    });

    it('devuelve array vacio cuando los datos son validos', () => {
      const errores = validarReceta({
        nombre: 'Café Espresso Simple',
        ingredientes: [
          { insumo_id: 1, cantidad: 0.018 },
          { insumo_id: 2, cantidad: 0.05 }
        ]
      });
      expect(errores).toEqual([]);
    });
  });
});

describe('Pruebas de integracion - API /api/productos/:id/receta', () => {
  let productoId;
  let productoSinRecetaId;
  let insumoCafeId;
  let insumoLecheId;

  beforeAll(async () => {
    await resetDb();

    const [catId] = await dbLocal('categorias').insert({ nombre: 'Cafetería' });
    const categoriaId = catId && catId.id ? catId.id : catId;

    const [pId1] = await dbLocal('productos').insert({
      categoria_id: categoriaId,
      nombre: 'Café Espresso',
      precio_venta: 1200,
      stock_actual: 50
    });
    productoId = pId1 && pId1.id ? pId1.id : pId1;

    const [pId2] = await dbLocal('productos').insert({
      categoria_id: categoriaId,
      nombre: 'Té Verde',
      precio_venta: 1000,
      stock_actual: 30
    });
    productoSinRecetaId = pId2 && pId2.id ? pId2.id : pId2;

    const [ins1] = await dbLocal('insumos').insert({
      nombre: 'Granos de Café',
      unidad_medida: 'kg',
      cantidad_disponible: 10,
      stock_minimo: 2,
      precio_costo: 5000
    });
    insumoCafeId = ins1 && ins1.id ? ins1.id : ins1;

    const [ins2] = await dbLocal('insumos').insert({
      nombre: 'Leche Entera',
      unidad_medida: 'lts',
      cantidad_disponible: 20,
      stock_minimo: 5,
      precio_costo: 1000
    });
    insumoLecheId = ins2 && ins2.id ? ins2.id : ins2;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('obtener receta de producto sin receta devuelve 200 con nombre null e ingredientes vacios', async () => {
    const res = await request(app).get(`/api/productos/${productoSinRecetaId}/receta`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.producto_id).toBe(productoSinRecetaId);
    expect(res.body.data.nombre).toBeNull();
    expect(res.body.data.ingredientes).toEqual([]);
  });

  it('obtener receta de producto inexistente responde 404', async () => {
    const res = await request(app).get('/api/productos/99999/receta');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
  });

  it('cantidad 0 responde 400', async () => {
    const res = await request(app)
      .put(`/api/productos/${productoId}/receta`)
      .send({
        nombre: 'Receta Inválida',
        ingredientes: [{ insumo_id: insumoCafeId, cantidad: 0 }]
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('VALIDACION');
  });

  it('crear receta responde 200 con ingredientes y unidades', async () => {
    const res = await request(app)
      .put(`/api/productos/${productoId}/receta`)
      .send({
        nombre: 'Receta Espresso',
        ingredientes: [{ insumo_id: insumoCafeId, cantidad: 0.018 }]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Receta Espresso');
    expect(res.body.data.producto_id).toBe(productoId);
    expect(res.body.data.ingredientes.length).toBe(1);
    expect(res.body.data.ingredientes[0].insumo_id).toBe(insumoCafeId);
    expect(res.body.data.ingredientes[0].insumo_nombre).toBe('Granos de Café');
    expect(res.body.data.ingredientes[0].unidad_medida).toBe('kg');
    expect(res.body.data.ingredientes[0].cantidad).toBe(0.018);
  });

  it('obtener receta existente devuelve los datos guardados', async () => {
    const res = await request(app).get(`/api/productos/${productoId}/receta`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Receta Espresso');
    expect(res.body.data.ingredientes.length).toBe(1);
    expect(res.body.data.ingredientes[0].insumo_nombre).toBe('Granos de Café');
  });

  it('reemplazar receta elimina los ingredientes viejos y guarda los nuevos', async () => {
    const res = await request(app)
      .put(`/api/productos/${productoId}/receta`)
      .send({
        nombre: 'Receta Cortado',
        ingredientes: [
          { insumo_id: insumoCafeId, cantidad: 0.018 },
          { insumo_id: insumoLecheId, cantidad: 0.05 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Receta Cortado');
    expect(res.body.data.ingredientes.length).toBe(2);

    const ingredientesDb = await dbLocal('ingredientes_recetas').where({
      receta_id: res.body.data.id
    });
    expect(ingredientesDb.length).toBe(2);
  });

  it('insumo inexistente responde 404 y no modifica la receta existente', async () => {
    const res = await request(app)
      .put(`/api/productos/${productoId}/receta`)
      .send({
        nombre: 'Receta Rota',
        ingredientes: [{ insumo_id: 99999, cantidad: 1 }]
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
    expect(res.body.message).toContain('99999');

    const recetaActual = await dbLocal('recetas').where({ producto_id: productoId }).first();
    expect(recetaActual.nombre).toBe('Receta Cortado');
  });

  it('borrar receta elimina la receta y sus ingredientes', async () => {
    const res = await request(app).delete(`/api/productos/${productoId}/receta`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const resBuscar = await request(app).get(`/api/productos/${productoId}/receta`);
    expect(resBuscar.status).toBe(200);
    expect(resBuscar.body.data.nombre).toBeNull();
    expect(resBuscar.body.data.ingredientes).toEqual([]);

    const ingredientesDb = await dbLocal('ingredientes_recetas').where({
      receta_id: res.body.data.id
    });
    expect(ingredientesDb.length).toBe(0);
  });

  it('borrar receta cuando el producto no tiene receta responde 404', async () => {
    const res = await request(app).delete(`/api/productos/${productoSinRecetaId}/receta`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
  });
});

