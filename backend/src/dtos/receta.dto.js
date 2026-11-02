const detectarRepetidos = (ingredientes = []) => {
  if (!Array.isArray(ingredientes)) return false;
  const vistos = new Set();
  for (const item of ingredientes) {
    const id = typeof item === 'object' && item !== null ? item.insumo_id : item;
    if (id === undefined || id === null) continue;
    const clave = Number(id);
    if (vistos.has(clave)) {
      return true;
    }
    vistos.add(clave);
  }
  return false;
};

const validarReceta = (body = {}) => {
  const errores = [];

  if (!body || typeof body.nombre !== 'string' || body.nombre.trim() === '') {
    errores.push('El nombre es obligatorio');
  } else if (body.nombre.trim().length > 100) {
    errores.push('El nombre no puede tener más de 100 caracteres');
  }

  if (!body || !Array.isArray(body.ingredientes) || body.ingredientes.length === 0) {
    errores.push('La receta debe contener al menos un ingrediente');
  } else {
    if (detectarRepetidos(body.ingredientes)) {
      errores.push('No se pueden repetir insumos en la misma receta');
    }

    body.ingredientes.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errores.push(`El ingrediente en la posición ${index} es inválido`);
        return;
      }

      const insumoId = Number(item.insumo_id);
      if (
        item.insumo_id === undefined ||
        item.insumo_id === null ||
        item.insumo_id === '' ||
        Number.isNaN(insumoId) ||
        !Number.isInteger(insumoId) ||
        insumoId <= 0
      ) {
        errores.push(`El insumo_id del ingrediente ${index + 1} es obligatorio`);
      }

      const cantidad = Number(item.cantidad);
      if (
        item.cantidad === undefined ||
        item.cantidad === null ||
        item.cantidad === '' ||
        Number.isNaN(cantidad) ||
        cantidad <= 0
      ) {
        errores.push(`La cantidad del ingrediente ${index + 1} debe ser un número mayor a 0`);
      }
    });
  }

  return errores;
};

module.exports = {
  validarReceta,
  detectarRepetidos
};

