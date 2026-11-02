import api from './api';

export const inventarioService = {
  obtenerInsumos: (params = {}) => api.get('/insumos', { params }),
  obtenerAlertasInsumos: () => api.get('/insumos/alertas'),
  crearInsumo: (datos) => api.post('/insumos', datos),
  actualizarInsumo: (id, datos) => api.put(`/insumos/${id}`, datos),
  eliminarInsumo: (id) => api.delete(`/insumos/${id}`),
  ingresarStock: (id, cantidad) => api.patch(`/insumos/${id}/ingreso`, { cantidad }),

  obtenerProveedores: () => api.get('/proveedores'),
  crearProveedor: (datos) => api.post('/proveedores', datos),
  actualizarProveedor: (id, datos) => api.put(`/proveedores/${id}`, datos),
  eliminarProveedor: (id) => api.delete(`/proveedores/${id}`),

  obtenerMermas: (params = {}) => api.get('/mermas', { params }),
  crearMerma: (datos) => api.post('/mermas', datos),
  eliminarMerma: (id) => api.delete(`/mermas/${id}`),

  getInsumos: (params = {}) => api.get('/insumos', { params }),
  getProveedores: () => api.get('/proveedores'),
  getMermas: (params = {}) => api.get('/mermas', { params })
};

export default inventarioService;
