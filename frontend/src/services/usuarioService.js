import api from './api';

export const usuarioService = {
  getAll: () => api.get('/usuarios'),

  getById: (id) => api.get(`/usuarios/${id}`),

  create: (datos) => api.post('/usuarios', datos),

  update: (id, datos) => api.put(`/usuarios/${id}`, datos),

  delete: (id) => api.delete(`/usuarios/${id}`),

  cambiarRol: (id, rolId) => api.patch(`/usuarios/${id}/rol`, { rol_id: rolId }),

  cambiarPermisos: (id, permisos) => api.patch(`/usuarios/${id}/permisos`, { permisos })
};

export default usuarioService;
