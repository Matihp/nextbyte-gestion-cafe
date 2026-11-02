import api from './api';

export const empleadoService = {
  obtenerTodos: (params = {}) => api.get('/empleados', { params }),
  obtenerPorId: (id) => api.get(`/empleados/${id}`),
  crear: (datos) => api.post('/empleados', datos),
  actualizar: (id, datos) => api.put(`/empleados/${id}`, datos),
  eliminar: (id) => api.delete(`/empleados/${id}`),

  getAll: (params = {}) => api.get('/empleados', { params }),
  getById: (id) => api.get(`/empleados/${id}`),
  create: (datos) => api.post('/empleados', datos),
  update: (id, datos) => api.put(`/empleados/${id}`, datos),
  delete: (id) => api.delete(`/empleados/${id}`)
};

export default empleadoService;
