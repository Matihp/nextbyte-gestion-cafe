const request = require('supertest');
const app = require('../src/app');
const { validarProducto } = require('../src/dtos/producto.dto');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');

describe('Pruebas unitarias de producto.dto', () => {
  it('detecta nombre vacio o ausente', () => {
    const erroresVacio = validarProducto({ categoria_id: 1, nombre: '', precio_venta: 100 });
    expect(erroresVacio).toContain('El nombre es obligatorio');

    const erroresEspacios = validarProducto({ categoria_id: 1, nombre: '   ', precio_venta: 100 });
    expect(erroresEspacios).toContain('El nombre es obligatorio');

    const erroresFaltante = validarProducto({ categoria_id: 1, precio_venta: 100 });
    expect(erroresFaltante).toContain('El nombre es obligatorio');
  });

  it('detecta precio negativo o cero', () => {
    const erroresNegativo = validarProducto({ categoria_id: 1, nombre: 'Café', precio_venta: -10 });
    expect(erroresNegativo).toContain('El precio de venta debe ser un número mayor a 0');

    const erroresCero = validarProducto({ categoria_id: 1, nombre: 'Café', precio_venta: 0 });
    expect(erroresCero).toContain('El precio de venta debe ser un número mayor a 0');
  });

  it('detecta stock negativo o no entero', () => {
    const erroresNegativo = validarProducto({
      categoria_id: 1,
      nombre: 'Café',
      precio_venta: 100,
      stock_actual: -5
    });
    expect(erroresNegativo).toContain('El stock actual debe ser un número entero mayor o igual a 0');

    const erroresDecimal = validarProducto({
      categoria_id: 1,
      nombre: 'Café',
      precio_venta: 100,
      stock_actual: 3.5
    });
    expect(erroresDecimal).toContain('El stock actual debe ser un número entero mayor o igual a 0');
  });

  it('devuelve array vacio cuando los datos son validos', () => {
    const errores = validarProducto({
      categoria_id: 1,
      nombre: 'Café con leche',
      precio_venta: 1500,
      stock_actual: 20,
      imagen: 'cafe.png'
    });
    expect(errores).toEqual([]);
  });

  it('detecta categoria_id ausente o invalido', () => {
    const erroresFaltante = validarProducto({ nombre: 'Café', precio_venta: 100 });
    expect(erroresFaltante).toContain('La categoría es obligatoria');

    const erroresInvalido = validarProducto({ categoria_id: 'invalido', nombre: 'Café', precio_venta: 100 });
    expect(erroresInvalido).toContain('La categoría es obligatoria');
  });
});

describe('Pruebas de integracion - API /api/productos', () => {
  let categoriaCafesId;
  let categoriaPostresId;

  beforeAll(async () => {
    await resetDb();

    const [idCat1] = await dbLocal('categorias').insert({ nombre: 'Cafés', icono: 'cafe.png' });
    categoriaCafesId = idCat1 && idCat1.id ? idCat1.id : idCat1;

    const [idCat2] = await dbLocal('categorias').insert({ nombre: 'Postres', icono: 'torta.png' });
    categoriaPostresId = idCat2 && idCat2.id ? idCat2.id : idCat2;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('crear con categoria valida: responde 201 y categoria_nombre', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Espresso',
        precio_venta: 1200,
        stock_actual: 15,
        imagen: 'espresso.png'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.nombre).toBe('Espresso');
    expect(res.body.data.categoria_nombre).toBe('Cafés');
    expect(res.body.data.stock_actual).toBe(15);
  });

  it('crear con categoria inexistente responde 404', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: 99999,
        nombre: 'Producto Fantasma',
        precio_venta: 1000
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
    expect(res.body.message).toBe('La categoría no existe');
  });

  it('duplicado: no permite dos productos con el mismo nombre en la misma categoria', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: '  espresso  ',
        precio_venta: 1400
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
  });

  it('permite dos productos con el mismo nombre en distintas categorias', async () => {
    const res = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaPostresId,
        nombre: 'Espresso',
        precio_venta: 1800
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.categoria_nombre).toBe('Postres');
  });

  it('listar con filtro por categoria', async () => {
    await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Capuchino',
        precio_venta: 1500
      });

    const resTodos = await request(app).get('/api/productos');
    expect(resTodos.status).toBe(200);
    expect(resTodos.body.success).toBe(true);
    expect(resTodos.body.data.length).toBe(3);

    const resFiltrados = await request(app).get(`/api/productos?categoria_id=${categoriaPostresId}`);
    expect(resFiltrados.status).toBe(200);
    expect(resFiltrados.body.data.length).toBe(1);
    expect(resFiltrados.body.data[0].categoria_nombre).toBe('Postres');
  });

  it('obtener por id devuelve el producto con categoria_nombre', async () => {
    const resCrear = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Ristretto',
        precio_venta: 1100
      });

    const id = resCrear.body.data.id;
    const res = await request(app).get(`/api/productos/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.nombre).toBe('Ristretto');
    expect(res.body.data.categoria_nombre).toBe('Cafés');
  });

  it('obtener inexistente responde 404', async () => {
    const res = await request(app).get('/api/productos/99999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NO_ENCONTRADO');
  });

  it('editar actualiza los datos del producto correctamente', async () => {
    const resCrear = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Cortado',
        precio_venta: 1300
      });

    const id = resCrear.body.data.id;
    const res = await request(app)
      .put(`/api/productos/${id}`)
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Cortado Doble',
        precio_venta: 1600,
        stock_actual: 25
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Cortado Doble');
    expect(res.body.data.precio_venta).toBe(1600);
    expect(res.body.data.stock_actual).toBe(25);
  });

  it('editar con duplicado en la misma categoria responde 409 DUPLICADO', async () => {
    const resCrear = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Latte',
        precio_venta: 1500
      });

    const id = resCrear.body.data.id;
    const res = await request(app)
      .put(`/api/productos/${id}`)
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Espresso',
        precio_venta: 1500
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('DUPLICADO');
  });

  it('borrar producto con pedidos asociados responde 409 RELACION', async () => {
    const resCrear = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Americano',
        precio_venta: 1200
      });

    const productoId = resCrear.body.data.id;

    await dbLocal('pedidos').insert({
      id: 'PED-TEST-001',
      cliente: 'Carlos',
      total: 2400,
      estado: 'pendiente',
      tipo_pedido: 'salon'
    });

    await dbLocal('detalles_pedidos').insert({
      id: 'DET-TEST-001',
      pedido_id: 'PED-TEST-001',
      producto_id: productoId,
      nombre_producto: 'Americano',
      cantidad: 2,
      precio_venta: 1200,
      precio_costo: 600
    });

    const res = await request(app).delete(`/api/productos/${productoId}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('RELACION');
    expect(res.body.message).toBe('No se puede eliminar: el producto tiene pedidos asociados');
  });

  it('borrar elimina un producto sin pedidos asociados', async () => {
    const resCrear = await request(app)
      .post('/api/productos')
      .send({
        categoria_id: categoriaCafesId,
        nombre: 'Mocaccino',
        precio_venta: 1700
      });

    const id = resCrear.body.data.id;
    const res = await request(app).delete(`/api/productos/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ id });

    const resBuscar = await request(app).get(`/api/productos/${id}`);
    expect(resBuscar.status).toBe(404);
  });
});
