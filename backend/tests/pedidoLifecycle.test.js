const request = require('supertest');
const app = require('../src/app');
const { dbLocal, resetDb, closeDb } = require('./helpers/db');
const pedidos = require('../src/services/pedidoService');
const comandas = require('../src/services/comandaService');
const productos = require('../src/services/productoService');
const pedidoRepository = require('../src/repositories/pedidoRepository');
const detalleRepository = require('../src/repositories/detallePedidoRepository');
const ventas = require('../src/repositories/registroVentaRepository');
const mermas = require('../src/repositories/registroMermaRepository');
const { validarPedido } = require('../src/dtos/pedido.dto');
const { hoy } = require('../src/utils/fechas');

const datosPedido = (overrides = {}) => ({
  tipo_pedido: 'salon', metodo_pago: 'efectivo',
  items: [{ producto_id: 1, cantidad: 2 }], ...overrides
});
const datosProducto = (overrides = {}) => ({
  nombre: 'Producto terminado', categoria_id: 1, precio_venta: 100,
  ...overrides
});
const stock = async () => Number((await dbLocal('productos').where({ id: 1 }).first()).stock_actual);
const insumos = () => dbLocal('insumos').orderBy('id').pluck('cantidad_disponible');
const empacar = async (id) => {
  await comandas.cambiarEstado(id, 'en_preparacion');
  await comandas.cambiarEstado(id, 'en_empaque');
};

beforeAll(resetDb);
afterAll(closeDb);
beforeEach(async () => {
  jest.restoreAllMocks();
  await dbLocal('registro_ventas').delete();
  await dbLocal('registros_mermas').delete();
  await dbLocal('detalles_pedidos').delete();
  await dbLocal('pedidos').delete();
  await dbLocal('ingredientes_recetas').delete();
  await dbLocal('productos').update({ receta_id: null });
  await dbLocal('recetas').delete();
  await dbLocal('productos').delete();
  await dbLocal('insumos').delete();
  await dbLocal('categorias').delete();
  await dbLocal('categorias').insert({ id: 1, nombre: 'Productos' });
  await dbLocal('insumos').insert([
    { id: 1, nombre: 'Harina', rubro: 'Alimentos', cantidad_disponible: 10, unidad_medida: 'kg', stock_minimo: 1, precio_costo: 10 },
    { id: 2, nombre: 'Azúcar', rubro: 'Alimentos', cantidad_disponible: 5, unidad_medida: 'kg', stock_minimo: 1, precio_costo: 20 }
  ]);
  await dbLocal('productos').insert({ id: 1, ...datosProducto(), stock_actual: 10 });
  await dbLocal('recetas').insert({ id: 1, producto_id: 1, nombre: 'Receta por producto' });
  await dbLocal('ingredientes_recetas').insert([
    { receta_id: 1, insumo_id: 1, cantidad: 0.5 },
    { receta_id: 1, insumo_id: 2, cantidad: 0.25 }
  ]);
});

afterEach(() => jest.restoreAllMocks());

describe('Idempotencia durable al crear pedidos', () => {
  // Simular lecturas previas al commit de un competidor para ejercitar el UNIQUE
  // real aun con el pool SQLite de test limitado a una conexión.
  const ocultarDosLecturas = (key) => {
    const prototipo = Object.getPrototypeOf(dbLocal.client);
    const procesarOriginal = prototipo.processResponse;
    let pendientes = 2;
    return jest.spyOn(prototipo, 'processResponse').mockImplementation(function (query, runner) {
      if (pendientes > 0 && query.method === 'first'
        && query.sql.includes('where `idempotency_key` = ?') && query.bindings.includes(key)) {
        pendientes -= 1;
        return undefined;
      }
      return procesarOriginal.call(this, query, runner);
    });
  };

  it('persiste clave y SHA256, y reproduce el pedido sin depender del orden de propiedades JSON', async () => {
    const opciones = { idempotencyKey: 'submit:001' };
    const original = await pedidos.crear(datosPedido({ cliente: 'Ana' }), opciones);
    const persistido = await dbLocal('pedidos').where({ id: original.id }).first();
    expect(persistido.idempotency_key).toBe('submit:001');
    expect(persistido.idempotency_hash).toMatch(/^[a-f0-9]{64}$/);
    const replay = await pedidos.crear({
      cliente: 'Ana', items: [{ cantidad: 2, producto_id: 1 }],
      metodo_pago: 'efectivo', tipo_pedido: 'salon'
    }, opciones);
    expect(replay).toEqual(original);
    expect(await stock()).toBe(8);
    expect(await dbLocal('pedidos')).toHaveLength(1);
    expect(await dbLocal('detalles_pedidos')).toHaveLength(1);
  });

  it.each(['completado', 'entregado', 'cancelado'])('replay devuelve el estado actual %s aunque no quede stock', async (estado) => {
    const opciones = { idempotencyKey: `submit-${estado}` };
    const datos = datosPedido({ items: [{ producto_id: 1, cantidad: 10 }] });
    const original = await pedidos.crear(datos, opciones);
    if (estado === 'cancelado') {
      await pedidos.cancelar(original.id, { esMerma: true });
    } else {
      await empacar(original.id);
      await comandas.completar(original.id);
      if (estado === 'entregado') await comandas.entregar(original.id);
    }
    expect(await stock()).toBe(0);
    const replay = await pedidos.crear(datos, opciones);
    expect(replay.id).toBe(original.id);
    expect(replay.estado).toBe(estado);
    expect(await stock()).toBe(0);
    expect(await dbLocal('pedidos')).toHaveLength(1);
  });

  it('replay no repone ítems que ya se eliminaron', async () => {
    const opciones = { idempotencyKey: 'submit-eliminado' };
    const datos = datosPedido();
    const original = await pedidos.crear(datos, opciones);
    await pedidos.eliminarItem(original.id, original.detalles[0].id);
    expect(await pedidos.crear(datos, opciones)).toMatchObject({ id: original.id, estado: 'cancelado', total: 0, detalles: [] });
    expect(await stock()).toBe(10);
  });

  it.each([
    { items: [{ producto_id: 1, cantidad: 3 }] },
    { items: [] },
    { estado: 'entregado' },
    { cliente: 'Otro cliente' }
  ])('misma clave con payload distinto devuelve 409 antes de validar entradas: %j', async (cambio) => {
    const opciones = { idempotencyKey: 'submit-conflicto' };
    await pedidos.crear(datosPedido(), opciones);
    await expect(pedidos.crear(datosPedido(cambio), opciones)).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    expect(await stock()).toBe(8);
    expect(await dbLocal('pedidos')).toHaveLength(1);
  });

  it('claves distintas y pedidos sin clave siguen siendo creaciones independientes', async () => {
    await pedidos.crear(datosPedido(), { idempotencyKey: 'submit-A' });
    await pedidos.crear(datosPedido(), { idempotencyKey: 'submit-B' });
    await pedidos.crear(datosPedido());
    await pedidos.crear(datosPedido());
    expect(await stock()).toBe(2);
    const filas = await dbLocal('pedidos');
    expect(filas).toHaveLength(4);
    expect(filas.filter((p) => p.idempotency_key === null && p.idempotency_hash === null)).toHaveLength(2);
  });

  it.each(['', ' ', 'con espacios', 'con/comillas', 'á', 'abc\n', 'x'.repeat(129), null, 123])('rechaza clave inválida %j antes de descontar', async (key) => {
    await expect(pedidos.crear(datosPedido(), { idempotencyKey: key })).rejects.toMatchObject({ status: 400, code: 'VALIDACION' });
    expect(await stock()).toBe(10);
    expect(await dbLocal('pedidos')).toHaveLength(0);
  });

  it('acepta una clave de 128 caracteres', async () => {
    const key = 'x'.repeat(128);
    expect((await pedidos.crear(datosPedido(), { idempotencyKey: key })).idempotency_key).toBe(key);
  });

  it('la reserva de clave y cabecera se revierte si falla el stock y permite corregir el submit', async () => {
    const opciones = { idempotencyKey: 'submit-rollback' };
    await expect(pedidos.crear(datosPedido({ items: [{ producto_id: 1, cantidad: 11 }] }), opciones))
      .rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' });
    expect(await stock()).toBe(10);
    expect(await dbLocal('pedidos')).toHaveLength(0);
    expect((await pedidos.crear(datosPedido(), opciones)).idempotency_key).toBe(opciones.idempotencyKey);
    expect(await stock()).toBe(8);
  });

  it('revierte clave y stock si falla la inserción de detalles', async () => {
    jest.spyOn(detalleRepository, 'createMany').mockRejectedValueOnce(new Error('detalle fallido'));
    await expect(pedidos.crear(datosPedido(), { idempotencyKey: 'submit-detalle' })).rejects.toThrow('detalle fallido');
    expect(await stock()).toBe(10);
    expect(await dbLocal('pedidos')).toHaveLength(0);
    expect(await dbLocal('detalles_pedidos')).toHaveLength(0);
  });

  it('dos submits simultáneos de la misma clave reservan stock una sola vez', async () => {
    const opciones = { idempotencyKey: 'submit-paralelo' };
    const datos = datosPedido({ items: [{ producto_id: 1, cantidad: 10 }] });
    const [primero, segundo] = await Promise.all([pedidos.crear(datos, opciones), pedidos.crear(datos, opciones)]);
    expect(primero.id).toBe(segundo.id);
    expect(await stock()).toBe(0);
    expect(await dbLocal('pedidos')).toHaveLength(1);
  });

  it.each([false, true])('recupera solo el UNIQUE exacto y compara hash tras rollback (payload distinto: %s)', async (distinto) => {
    const opciones = { idempotencyKey: 'submit-carrera' };
    const original = await pedidos.crear(datosPedido(), opciones);
    ocultarDosLecturas(opciones.idempotencyKey);
    const crearCabecera = jest.spyOn(pedidoRepository, 'create');
    const intento = pedidos.crear(datosPedido(distinto ? { items: [{ producto_id: 1, cantidad: 3 }] } : {}), opciones);
    if (distinto) {
      await expect(intento).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });
    } else {
      expect((await intento).id).toBe(original.id);
    }
    expect(crearCabecera).toHaveBeenCalledTimes(1);
    expect(await stock()).toBe(8);
    expect(await dbLocal('pedidos')).toHaveLength(1);
  });

  it.each([
    ['SQLITE_CONSTRAINT', 'UNIQUE constraint failed: pedidos.id'],
    ['SQLITE_CONSTRAINT', 'UNIQUE constraint failed: pedidos.idempotency_key, pedidos.id'],
    ['ECONNRESET', 'Respuesta perdida al confirmar']
  ])('no confunde otros errores con replay ni reintenta escrituras: %s %s', async (code, message) => {
    const opciones = { idempotencyKey: 'submit-otro-error' };
    await pedidos.crear(datosPedido(), opciones);
    ocultarDosLecturas(opciones.idempotencyKey);
    const error = Object.assign(new Error(message), { code });
    const crearCabecera = jest.spyOn(pedidoRepository, 'create').mockRejectedValueOnce(error);
    await expect(pedidos.crear(datosPedido(), opciones)).rejects.toBe(error);
    expect(crearCabecera).toHaveBeenCalledTimes(1);
    expect(await stock()).toBe(8);
    expect(await dbLocal('pedidos')).toHaveLength(1);
  });

  it('un commit confirmado cuya respuesta se pierde no se reintenta y admite replay posterior', async () => {
    const opciones = { idempotencyKey: 'submit-respuesta-perdida' };
    const prototipo = Object.getPrototypeOf(dbLocal.client);
    const queryOriginal = prototipo._query;
    const error = Object.assign(new Error('Respuesta perdida después del commit'), { code: 'ECONNRESET' });
    let perderRespuesta = true;
    const query = jest.spyOn(prototipo, '_query').mockImplementation(async function (conn, consulta) {
      const resultado = await queryOriginal.call(this, conn, consulta);
      if (perderRespuesta && /^COMMIT\b/i.test(consulta.sql)) {
        perderRespuesta = false;
        throw error;
      }
      return resultado;
    });
    const crearCabecera = jest.spyOn(pedidoRepository, 'create');
    await expect(pedidos.crear(datosPedido(), opciones)).rejects.toBe(error);
    expect(crearCabecera).toHaveBeenCalledTimes(1);
    query.mockRestore();
    const persistido = await dbLocal('pedidos').where({ idempotency_key: opciones.idempotencyKey }).first();
    expect(persistido).toBeDefined();
    expect((await pedidos.crear(datosPedido(), opciones)).id).toBe(persistido.id);
    expect(crearCabecera).toHaveBeenCalledTimes(1);
    expect(await stock()).toBe(8);
    expect(await dbLocal('pedidos')).toHaveLength(1);
  });

  it('POST propaga el header, permite replay, y expone conflictos/validación HTTP', async () => {
    const authOriginal = process.env.AUTH_ENABLED;
    process.env.AUTH_ENABLED = 'false';
    try {
      const primero = await request(app).post('/api/pedidos').set('Idempotency-Key', 'http-001').send(datosPedido());
      const replay = await request(app).post('/api/pedidos').set('Idempotency-Key', 'http-001').send(datosPedido());
      expect(primero.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(replay.body.data.id).toBe(primero.body.data.id);
      const conflicto = await request(app).post('/api/pedidos').set('Idempotency-Key', 'http-001').send(datosPedido({ items: [] }));
      expect(conflicto.status).toBe(409);
      expect(conflicto.body.error).toBe('IDEMPOTENCY_CONFLICT');
      const invalida = await request(app).post('/api/pedidos').set('Idempotency-Key', 'clave invalida').send(datosPedido());
      expect(invalida.status).toBe(400);
      expect(await stock()).toBe(8);
    } finally {
      if (authOriginal === undefined) delete process.env.AUTH_ENABLED;
      else process.env.AUTH_ENABLED = authOriginal;
    }
  });
});

it('crear-completar-entregar y repetir conserva inventario y una sola venta', async () => {
  const inicial = await insumos();
  const pedido = await pedidos.crear(datosPedido());
  expect(await stock()).toBe(8);
  expect(await insumos()).toEqual(inicial);
  expect(pedido.detalles[0].precio_costo).toBe(10);
  await empacar(pedido.id);
  const completado = await comandas.completar(pedido.id);
  expect(completado.estado).toBe('completado');
  expect(completado.insumos_descontados).toEqual([]);
  await comandas.completar(pedido.id);
  expect((await comandas.entregar(pedido.id)).estado).toBe('entregado');
  expect((await comandas.entregar(pedido.id)).estado).toBe('entregado');
  expect((await comandas.completar(pedido.id)).estado).toBe('entregado');
  expect(await stock()).toBe(8);
  expect(await insumos()).toEqual(inicial);
  expect(await dbLocal('registro_ventas').where({ pedido_id: pedido.id })).toHaveLength(1);
  expect(await ventas.obtenerVentasDia(hoy())).toMatchObject({ cantidad_pedidos: 1, total_venta: 200, total_costo: 20 });
  expect(await ventas.obtenerVentasRango(hoy(), hoy())).toHaveLength(1);
  expect(await ventas.obtenerTotalesGanancias(hoy(), hoy())).toEqual({ total_venta: 200, total_costo: 20 });
  expect((await ventas.obtenerTopProductos(hoy(), hoy()))[0]).toMatchObject({ unidades: 2, ingresos: 200 });
  expect((await ventas.obtenerVentasPorCategoria())[0].cantidadVendida).toBe(2);
});

it.each(['pendiente', 'en_preparacion'])('permite crear en %s', async (estado) => {
  expect((await pedidos.crear(datosPedido({ estado }))).estado).toBe(estado);
});

it.each(['en_empaque', 'completado', 'entregado', 'cancelado', null, 'otro'])('rechaza estado inicial %s sin reservar', async (estado) => {
  await expect(pedidos.crear(datosPedido({ estado }))).rejects.toMatchObject({ code: 'VALIDACION' });
  expect(await stock()).toBe(10);
  expect(await dbLocal('pedidos')).toHaveLength(0);
});

it('rechaza duplicados incluso mezclando IDs numéricos y strings', async () => {
  const datos = datosPedido({ items: [{ producto_id: 1, cantidad: 6 }, { producto_id: '1', cantidad: 6 }] });
  expect(validarPedido(datos)).toContain('No se puede repetir el mismo producto en los ítems del pedido');
  await expect(pedidos.crear(datos)).rejects.toMatchObject({ code: 'VALIDACION' });
  expect(await stock()).toBe(10);
});

it('revierte reservas previas si otro producto no alcanza', async () => {
  await dbLocal('productos').insert({ id: 2, ...datosProducto({ nombre: 'Sin stock' }), stock_actual: 0 });
  await expect(pedidos.crear(datosPedido({ items: [
    { producto_id: 1, cantidad: 2 }, { producto_id: 2, cantidad: 1 }
  ] }))).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' });
  expect(await stock()).toBe(10);
  expect(await dbLocal('pedidos')).toHaveLength(0);
  expect(await dbLocal('detalles_pedidos')).toHaveLength(0);
});

it('cancelar es idempotente aunque el reintento cambie la opción de merma', async () => {
  const pedido = await pedidos.crear(datosPedido());
  await pedidos.cancelar(pedido.id);
  await pedidos.cancelar(pedido.id);
  await pedidos.cancelar(pedido.id, { esMerma: true });
  expect(await stock()).toBe(10);
  expect(await dbLocal('registros_mermas')).toHaveLength(0);
  expect(await dbLocal('registro_ventas')).toHaveLength(0);
});

it('cancelar con merma no devuelve stock ni duplica auditoría', async () => {
  const pedido = await pedidos.crear(datosPedido());
  await pedidos.cancelar(pedido.id, { esMerma: true });
  await pedidos.cancelar(pedido.id, { esMerma: true });
  await pedidos.cancelar(pedido.id);
  expect(await stock()).toBe(8);
  expect(await dbLocal('registros_mermas')).toHaveLength(1);
});

it.each(['completado', 'entregado'])('bloquea cancelar y eliminar ítems de un pedido %s', async (estado) => {
  const pedido = await pedidos.crear(datosPedido());
  await empacar(pedido.id);
  await comandas.completar(pedido.id);
  if (estado === 'entregado') await comandas.entregar(pedido.id);
  await expect(pedidos.cancelar(pedido.id)).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' });
  await expect(pedidos.eliminarItem(pedido.id, pedido.detalles[0].id)).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' });
  expect(await stock()).toBe(8);
  expect((await pedidos.obtenerPorId(pedido.id)).detalles).toHaveLength(1);
});

it('eliminar el último ítem devuelve una vez, cancela y no permite repetir', async () => {
  const pedido = await pedidos.crear(datosPedido());
  expect(await pedidos.eliminarItem(pedido.id, pedido.detalles[0].id)).toMatchObject({ estado: 'cancelado', total: 0, detalles: [] });
  await expect(pedidos.eliminarItem(pedido.id, pedido.detalles[0].id)).rejects.toMatchObject({ code: 'ESTADO_INVALIDO' });
  await pedidos.cancelar(pedido.id);
  expect(await stock()).toBe(10);
});

it('revierte el estado si falla el registro de venta', async () => {
  const pedido = await pedidos.crear(datosPedido());
  await empacar(pedido.id);
  jest.spyOn(ventas, 'guardar').mockRejectedValueOnce(new Error('venta fallida'));
  await expect(comandas.completar(pedido.id)).rejects.toThrow('venta fallida');
  expect((await pedidos.obtenerPorId(pedido.id)).estado).toBe('en_empaque');
  expect(await dbLocal('registro_ventas')).toHaveLength(0);
  expect(await stock()).toBe(8);
});

it.each(['cancelar', 'eliminarItem'])('revierte %s y detalles si falla la auditoría', async (operacion) => {
  const pedido = await pedidos.crear(datosPedido());
  jest.spyOn(mermas, 'create').mockRejectedValueOnce(new Error('auditoría fallida'));
  const promesa = operacion === 'cancelar'
    ? pedidos.cancelar(pedido.id, { esMerma: true })
    : pedidos.eliminarItem(pedido.id, pedido.detalles[0].id, { esMerma: true });
  await expect(promesa).rejects.toThrow('auditoría fallida');
  expect(await pedidos.obtenerPorId(pedido.id)).toMatchObject({ estado: 'pendiente', total: 200 });
  expect((await pedidos.obtenerPorId(pedido.id)).detalles).toHaveLength(1);
  expect(await stock()).toBe(8);
});

it('revierte eliminación y total si falla la escritura del detalle', async () => {
  const pedido = await pedidos.crear(datosPedido());
  jest.spyOn(detalleRepository, 'delete').mockRejectedValueOnce(new Error('detalle fallido'));
  await expect(pedidos.eliminarItem(pedido.id, pedido.detalles[0].id)).rejects.toThrow('detalle fallido');
  expect(await stock()).toBe(8);
  expect((await pedidos.obtenerPorId(pedido.id)).estado).toBe('pendiente');
});

it.each(['avanzar', 'completar', 'entregar', 'cancelar', 'eliminarItem'])('aborta %s al perder el CAS', async (operacion) => {
  const pedido = await pedidos.crear(datosPedido());
  if (['completar', 'entregar'].includes(operacion)) await empacar(pedido.id);
  if (operacion === 'entregar') await comandas.completar(pedido.id);
  const anterior = await pedidos.obtenerPorId(pedido.id);
  jest.spyOn(pedidoRepository, 'updateIfEstado').mockResolvedValueOnce(0);
  const operaciones = {
    avanzar: () => comandas.cambiarEstado(pedido.id, 'en_preparacion'),
    completar: () => comandas.completar(pedido.id),
    entregar: () => comandas.entregar(pedido.id),
    cancelar: () => pedidos.cancelar(pedido.id),
    eliminarItem: () => pedidos.eliminarItem(pedido.id, pedido.detalles[0].id)
  };
  await expect(operaciones[operacion]()).rejects.toMatchObject({ statusCode: 409 });
  expect(await pedidos.obtenerPorId(pedido.id)).toEqual(anterior);
  expect(await stock()).toBe(8);
});

it('creaciones concurrentes no venden más unidades que las disponibles', async () => {
  const resultados = await Promise.allSettled([
    pedidos.crear(datosPedido({ items: [{ producto_id: 1, cantidad: 6 }] })),
    pedidos.crear(datosPedido({ items: [{ producto_id: 1, cantidad: 6 }] }))
  ]);
  expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(resultados.find((r) => r.status === 'rejected').reason.code).toBe('STOCK_INSUFICIENTE');
  expect(await stock()).toBe(4);
  expect(await dbLocal('pedidos')).toHaveLength(1);
});

it('completar y cancelar repetidos en paralelo no duplican sus efectos', async () => {
  const pedido = await pedidos.crear(datosPedido());
  await empacar(pedido.id);
  await Promise.all([comandas.completar(pedido.id), comandas.completar(pedido.id)]);
  expect(await dbLocal('registro_ventas')).toHaveLength(1);
  const otro = await pedidos.crear(datosPedido());
  await Promise.all([pedidos.cancelar(otro.id), pedidos.cancelar(otro.id)]);
  expect(await stock()).toBe(8);
});

it('una venta y reposición concurrentes calculan fabricación desde el stock transaccional', async () => {
  await Promise.all([
    pedidos.crear(datosPedido()),
    productos.update(1, datosProducto({ stock_actual: 12 }))
  ]);
  const unidadesFabricadas = (await stock()) + 2 - 10;
  expect(await insumos()).toEqual([10 - unidadesFabricadas * 0.5, 5 - unidadesFabricadas * 0.25]);
});

it('reposiciones consumen insumos según la receta fallback y no al vender', async () => {
  await productos.update(1, datosProducto({ stock_actual: 12 }));
  expect(await stock()).toBe(12);
  expect(await insumos()).toEqual([9, 4.5]);
  await productos.update(1, datosProducto({ stock_actual: 12 }));
  expect(await insumos()).toEqual([9, 4.5]);
});

it('revierte reposición y descuento parcial de ingredientes si otro insumo no alcanza', async () => {
  await dbLocal('insumos').where({ id: 2 }).update({ cantidad_disponible: 0 });
  await expect(productos.update(1, datosProducto({ stock_actual: 12 }))).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' });
  expect(await stock()).toBe(10);
  expect(await insumos()).toEqual([10, 0]);
});

it('usa la receta explícita tanto al fabricar como al calcular costo', async () => {
  await dbLocal('recetas').insert({ id: 2, producto_id: null, nombre: 'Receta compartida' });
  await dbLocal('ingredientes_recetas').insert({ receta_id: 2, insumo_id: 1, cantidad: 1 });
  const nuevo = await productos.create(datosProducto({ nombre: 'Otro', receta_id: 2, stock_actual: 2 }));
  expect(nuevo.precio_costo).toBe(10);
  expect(await insumos()).toEqual([8, 5]);
  await productos.update(nuevo.id, datosProducto({ nombre: 'Otro', stock_actual: 3 }));
  expect(await insumos()).toEqual([7, 5]);
});

it('una receta explícita inexistente no se confunde con un producto de igual ID', async () => {
  await expect(productos.create(datosProducto({ nombre: 'Otro', receta_id: 999, stock_actual: 2 })))
    .rejects.toMatchObject({ code: 'NO_ENCONTRADO' });
  expect(await insumos()).toEqual([10, 5]);
});

it('no oculta errores de auditoría al retirar producto', async () => {

  // Una restricción real fuerza el fallo del INSERT de auditoría dentro de la transacción.
  await dbLocal.raw("CREATE TRIGGER fallo_merma BEFORE INSERT ON registros_mermas BEGIN SELECT RAISE(ABORT, 'auditoria producto fallida'); END");
  try {
    await expect(productos.remove(1, 'MERMA', 2)).rejects.toThrow('auditoria producto fallida');
    expect(await stock()).toBe(10);
    expect(await dbLocal('registros_mermas')).toHaveLength(0);
  } finally {
    await dbLocal.raw('DROP TRIGGER fallo_merma');

  }
});
