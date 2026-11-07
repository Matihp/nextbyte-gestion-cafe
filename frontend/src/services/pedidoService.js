import api from './api';

export const pedidoService = {
  obtenerTodos: (params = {}) => api.get('/pedidos', { params }),
  obtenerPorId: (id) => api.get(`/pedidos/${id}`),
  crear: (datos) => api.post('/pedidos', datos),
  cancelar: (id, datos = {}) => api.patch(`/pedidos/${id}/cancelar`, datos),
  eliminarItem: (id, detalleId, datos = {}) => api.delete(`/pedidos/${id}/items/${detalleId}`, { data: datos }),

  getAll: (params = {}) => api.get('/pedidos', { params }),
  getById: (id) => api.get(`/pedidos/${id}`),
  create: (datos) => api.post('/pedidos', datos)
};

export default pedidoService;
