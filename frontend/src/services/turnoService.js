import api from './api';

export const turnoService = {
  obtenerTodos: (params = {}) => api.get('/turnos', { params }),
  guardar: (datos) => api.put('/turnos', datos),
  eliminar: (id) => api.delete(`/turnos/${id}`),

  getAll: (params = {}) => api.get('/turnos', { params }),
  delete: (id) => api.delete(`/turnos/${id}`)
};

export default turnoService;
