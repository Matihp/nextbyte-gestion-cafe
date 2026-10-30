const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');
const { validarProveedor, normalizarIdsInsumos } = require('../src/dtos/proveedor.dto');

describe('Pruebas unitarias del módulo Proveedores', () => {
  describe('validarProveedor', () => {
    it('acepta un proveedor con datos completos y válidos', () => {
      const body = {
        codigo: 'PROV-001',
        empresa: 'Café de Colombia SA',
        nombre_contacto: 'Juan',
        apellido_contacto: 'Pérez',
        telefono: '1122334455',
        email: 'contacto@cafecolombia.com',
        rubro: 'Cafetería',
        insumos_asignados_ids: [1, 2],
      };
      const errores = validarProveedor(body);
      expect(errores).toEqual([]);
    });

    it('rechaza si falta el código o la empresa', () => {
      const errores = validarProveedor({ codigo: '', empresa: '   ' });
      expect(errores).toContain('El código es obligatorio');
      expect(errores).toContain('La empresa es obligatoria');
    });

    it('rechaza si el email tiene un formato inválido', () => {
      const body = {
        codigo: 'PROV-002',
        empresa: 'Lácteos La Serenísima',
        email: 'email-invalido-sin-arroba',
      };
      const errores = validarProveedor(body);
      expect(errores).toContain('El email debe tener un formato válido');
    });

    it('rechaza si insumos_asignados_ids no es un array', () => {
      const body = {
        codigo: 'PROV-003',
        empresa: 'Distribuidora Central',
        insumos_asignados_ids: '1,2,3',
      };
      const errores = validarProveedor(body);
      expect(errores).toContain('insumos_asignados_ids debe ser un array');
    });
  });

  describe('normalizarIdsInsumos', () => {
    it('convierte strings numéricos a números y descarta duplicados', () => {
      const entrada = ['1', 2, '2', 3, 1];
      const resultado = normalizarIdsInsumos(entrada);
      expect(resultado).toEqual([1, 2, 3]);
    });

    it('retorna un array vacío si no se pasan IDs', () => {
      expect(normalizarIdsInsumos()).toEqual([]);
      expect(normalizarIdsInsumos([])).toEqual([]);
    });

    it('lanza un error si contiene elementos no numéricos', () => {
      expect(() => normalizarIdsInsumos([1, 'no-es-numero'])).toThrow(
        'Los IDs de insumos deben ser números enteros'
      );
      expect(() => normalizarIdsInsumos([1, null])).toThrow(
        'Los IDs de insumos deben ser números enteros'
      );
      expect(() => normalizarIdsInsumos([1, 2.5])).toThrow(
        'Los IDs de insumos deben ser números enteros'
      );
    });

    it('lanza un error si el argumento no es un array', () => {
      expect(() => normalizarIdsInsumos('invalido')).toThrow(
        'insumos_asignados_ids debe ser un array'
      );
    });
  });
});

describe('Pruebas de integración - API /api/proveedores', () => {
  let insumoCafeId;
  let insumoLecheId;
  let insumoAzucarId;

  beforeAll(async () => {
    await resetDb();

    const [idCafe] = await dbLocal('insumos').insert({
      nombre: 'Granos de Café Tostado',
      rubro: 'Cafetería',
      cantidad_disponible: 50,
      unidad_medida: 'kg',
      stock_minimo: 10,
      precio_costo: 8500,
      ultima_actualizacion: '2026-10-30 10:00:00',
      fecha_ingreso: '2026-10-30',
      fecha_vencimiento: '2026-12-31',
    });
    insumoCafeId = idCafe;

    const [idLeche] = await dbLocal('insumos').insert({
      nombre: 'Leche Entera La Paulina',
      rubro: 'Lácteos',
      cantidad_disponible: 100,
      unidad_medida: 'lts',
      stock_minimo: 20,
      precio_costo: 1300,
      ultima_actualizacion: '2026-10-30 10:00:00',
      fecha_ingreso: '2026-10-30',
      fecha_vencimiento: '2026-11-20',
    });
    insumoLecheId = idLeche;

    const [idAzucar] = await dbLocal('insumos').insert({
      nombre: 'Azúcar Ledesma',
      rubro: 'Almacén',
      cantidad_disponible: 30,
      unidad_medida: 'kg',
      stock_minimo: 5,
      precio_costo: 900,
      ultima_actualizacion: '2026-10-30 10:00:00',
      fecha_ingreso: '2026-10-30',
      fecha_vencimiento: '2027-01-01',
    });
    insumoAzucarId = idAzucar;
  });

  afterAll(async () => {
    await closeDb();
  });

  let proveedorCreadoId;

  it('POST /api/proveedores crea un proveedor con insumos válidos y responde 201', async () => {
    const respuesta = await request(app)
      .post('/api/proveedores')
      .send({
        codigo: 'PROV-100',
        empresa: 'Granos y Cafés Especiales',
        nombre_contacto: 'Martín',
        apellido_contacto: 'Gómez',
        telefono: '1155443322',
        email: 'martin@granosycafes.com',
        rubro: 'Café',
        insumos_asignados_ids: [insumoCafeId, insumoLecheId],
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.id).toBeDefined();
    expect(respuesta.body.data.codigo).toBe('PROV-100');
    expect(respuesta.body.data.empresa).toBe('Granos y Cafés Especiales');
    expect(respuesta.body.data.insumos_asignados_ids).toEqual([insumoCafeId, insumoLecheId]);
    expect(respuesta.body.data.insumos).toHaveLength(2);
    expect(respuesta.body.data.insumos[0]).toHaveProperty('id');
    expect(respuesta.body.data.insumos[0]).toHaveProperty('nombre');
    expect(respuesta.body.data.insumos[0]).toHaveProperty('unidad_medida');

    proveedorCreadoId = respuesta.body.data.id;
  });

  it('POST /api/proveedores responde 404 si se incluye un insumo inexistente', async () => {
    const respuesta = await request(app)
      .post('/api/proveedores')
      .send({
        codigo: 'PROV-101',
        empresa: 'Insumos Inexistentes SA',
        insumos_asignados_ids: [insumoCafeId, 99999],
      });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('NO_ENCONTRADO');
    expect(respuesta.body.message).toContain('El insumo 99999 no existe');
  });

  it('POST /api/proveedores responde 409 si el código está duplicado', async () => {
    const respuesta = await request(app)
      .post('/api/proveedores')
      .send({
        codigo: 'PROV-100',
        empresa: 'Otra Empresa Con Mismo Código',
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('DUPLICADO');
    expect(respuesta.body.message).toContain('Ya existe un proveedor con ese código');
  });

  it('GET /api/proveedores lista todos los proveedores con sus insumos resueltos', async () => {
    const respuesta = await request(app).get('/api/proveedores');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(Array.isArray(respuesta.body.data)).toBe(true);
    expect(respuesta.body.data.length).toBeGreaterThanOrEqual(1);

    const encontrado = respuesta.body.data.find((p) => p.id === proveedorCreadoId);
    expect(encontrado).toBeDefined();
    expect(encontrado.insumos).toHaveLength(2);
  });

  it('GET /api/proveedores/:id devuelve un proveedor específico con sus insumos', async () => {
    const respuesta = await request(app).get(`/api/proveedores/${proveedorCreadoId}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.id).toBe(proveedorCreadoId);
    expect(respuesta.body.data.insumos).toHaveLength(2);
  });

  it('GET /api/proveedores/:id responde 404 si no existe', async () => {
    const respuesta = await request(app).get('/api/proveedores/id-inexistente-123');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('NO_ENCONTRADO');
  });

  it('PUT /api/proveedores/:id edita el proveedor cambiando los insumos asignados', async () => {
    const respuesta = await request(app)
      .put(`/api/proveedores/${proveedorCreadoId}`)
      .send({
        codigo: 'PROV-100',
        empresa: 'Granos y Cafés Especiales Modificado',
        nombre_contacto: 'Martín Modificado',
        apellido_contacto: 'Gómez',
        telefono: '1199887766',
        email: 'martin.nuevo@granosycafes.com',
        rubro: 'Cafetería y Almacén',
        insumos_asignados_ids: [insumoAzucarId],
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.empresa).toBe('Granos y Cafés Especiales Modificado');
    expect(respuesta.body.data.insumos_asignados_ids).toEqual([insumoAzucarId]);
    expect(respuesta.body.data.insumos).toHaveLength(1);
    expect(respuesta.body.data.insumos[0].id).toBe(insumoAzucarId);
    expect(respuesta.body.data.insumos[0].nombre).toBe('Azúcar Ledesma');
  });

  it('PUT /api/proveedores/:id responde 409 si se repite el código de otro proveedor', async () => {
    const segundoProv = await request(app)
      .post('/api/proveedores')
      .send({
        codigo: 'PROV-200',
        empresa: 'Segundo Proveedor SA',
      });
    expect(segundoProv.status).toBe(201);

    const respuesta = await request(app)
      .put(`/api/proveedores/${proveedorCreadoId}`)
      .send({
        codigo: 'PROV-200',
        empresa: 'Intentando Robar Código',
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('DUPLICADO');
  });

  it('DELETE /api/proveedores/:id elimina el proveedor', async () => {
    const respuesta = await request(app).delete(`/api/proveedores/${proveedorCreadoId}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.id).toBe(proveedorCreadoId);

    const busqueda = await request(app).get(`/api/proveedores/${proveedorCreadoId}`);
    expect(busqueda.status).toBe(404);
  });

  it('DELETE /api/proveedores/:id responde 404 si el proveedor no existe', async () => {
    const respuesta = await request(app).delete(`/api/proveedores/${proveedorCreadoId}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.success).toBe(false);
    expect(respuesta.body.error).toBe('NO_ENCONTRADO');
  });
});

