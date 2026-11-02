const request = require('supertest');
const app = require('../src/app');
const { validarCategoria } = require('../src/dtos/categoria.dto');
const { normalizarNombre } = require('../src/services/categoriaService');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas unitarias de categoria.dto', () => {
  it('detecta nombre vacio o ausente', () => {
    const erroresVacio = validarCategoria({ nombre: '' });
    expect(erroresVacio).toContain('El nombre es obligatorio');

    const erroresEspacios = validarCategoria({ nombre: '   ' });
    expect(erroresEspacios).toContain('El nombre es obligatorio');

    const erroresFaltante = validarCategoria({});
    expect(erroresFaltante).toContain('El nombre es obligatorio');
  });

  it('detecta nombre que supera los 100 caracteres', () => {
    const nombreLargo = 'a'.repeat(101);
    const errores = validarCategoria({ nombre: nombreLargo });
    expect(errores).toContain('El nombre no puede tener más de 100 caracteres');
  });

  it('devuelve array vacio cuando los datos son validos', () => {
    const errores = validarCategoria({ nombre: 'Café', icono: 'coffee.png' });
    expect(errores).toEqual([]);
  });

  it('detecta icono de tipo invalido', () => {
    const errores = validarCategoria({ nombre: 'Café', icono: 123 });
    expect(errores).toContain('El icono debe ser una cadena de texto');
  });
});

describe('Pruebas unitarias de normalizarNombre', () => {
  it('remueve espacios en los extremos y convierte a minusculas', () => {
    const resultado = normalizarNombre('   Café Especial   ');
    expect(resultado).toBe('café especial');
  });

  it('retorna string vacio ante valores no string', () => {
    expect(normalizarNombre(null)).toBe('');
    expect(normalizarNombre(undefined)).toBe('');
    expect(normalizarNombre(123)).toBe('');
  });
});

describe('Pruebas de integracion - API /api/categorias', () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('crear: POST /api/categorias crea una categoria y responde 201', async () => {
    const res = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Cafetería', icono: 'taza.png' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.nombre).toBe('Cafetería');
    expect(res.body.data.icono).toBe('taza.png');
  });

  it('duplicado: POST /api/categorias responde 409 DUPLICADO si ya existe el nombre', async () => {
    const res = await request(app)
      .post('/api/categorias')
      .send({ nombre: '  cafetería  ' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
    expect(res.body.message).toBe('Ya existe una categoría con ese nombre');
  });

  it('listar: GET /api/categorias lista las categorias ordenadas por nombre', async () => {
    await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Bebidas' });

    const res = await request(app).get('/api/categorias');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].nombre).toBe('Bebidas');
    expect(res.body.data[1].nombre).toBe('Cafetería');
  });

  it('obtener: GET /api/categorias/:id devuelve una categoria existente', async () => {
    const resCrear = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Pastelería' });

    const id = resCrear.body.data.id;
    const res = await request(app).get(`/api/categorias/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.nombre).toBe('Pastelería');
  });

  it('obtener inexistente: GET /api/categorias/:id responde 404', async () => {
    const res = await request(app).get('/api/categorias/99999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
  });

  it('editar: PUT /api/categorias/:id actualiza una categoria correctamente', async () => {
    const resCrear = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Tortas' });

    const id = resCrear.body.data.id;
    const res = await request(app)
      .put(`/api/categorias/${id}`)
      .send({ nombre: 'Tortas Especiales', icono: 'torta.png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Tortas Especiales');
    expect(res.body.data.icono).toBe('torta.png');
  });

  it('editar con duplicado: PUT /api/categorias/:id responde 409 con nombre de otra categoria', async () => {
    const resCrear = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Sandwiches' });

    const id = resCrear.body.data.id;
    const res = await request(app)
      .put(`/api/categorias/${id}`)
      .send({ nombre: 'bebidas' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
  });

  it('borrar categoria con producto: DELETE /api/categorias/:id responde 409 RELACION', async () => {
    const resCrear = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Con Productos' });

    const categoriaId = resCrear.body.data.id;

    await dbLocal('productos').insert({
      categoria_id: categoriaId,
      nombre: 'Producto de Prueba',
      precio_venta: 1500,
      stock_actual: 10
    });

    const res = await request(app).delete(`/api/categorias/${categoriaId}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('RELACION');
    expect(res.body.message).toBe('No se puede eliminar: la categoría tiene productos');
  });

  it('borrar: DELETE /api/categorias/:id elimina una categoria sin productos', async () => {
    const resCrear = await request(app)
      .post('/api/categorias')
      .send({ nombre: 'Para Borrar' });

    const id = resCrear.body.data.id;
    const res = await request(app).delete(`/api/categorias/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ id });

    const resBuscar = await request(app).get(`/api/categorias/${id}`);
    expect(resBuscar.status).toBe(404);
  });
});

