import api from './api';

export const pedidoService = {
  obtenerTodos: (params = {}) => api.get('/pedidos', { params }),
  obtenerPorId: (id) => api.get(`/pedidos/${id}`),
  crear: (datos) => api.post('/pedidos', datos),
  cancelar: (id) => api.patch(`/pedidos/${id}/cancelar`),
  eliminarItem: (id, detalleId) => api.delete(`/pedidos/${id}/items/${detalleId}`),

  getAll: (params = {}) => api.get('/pedidos', { params }),
  getById: (id) => api.get(`/pedidos/${id}`),
  create: (datos) => api.post('/pedidos', datos)
};

export default pedidoService;
