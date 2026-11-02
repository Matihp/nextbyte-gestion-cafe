import api from './api';

export const rolService = {
  obtenerTodos: () => api.get('/roles'),
  obtenerPorId: (id) => api.get(`/roles/${id}`),
  crear: (datos) => api.post('/roles', datos),
  actualizar: (id, datos) => api.put(`/roles/${id}`, datos),
  eliminar: (id) => api.delete(`/roles/${id}`),
  cambiarRolUsuario: (id, rolId) => api.patch(`/usuarios/${id}/rol`, { rol_id: rolId }),
  cambiarPermisosUsuario: (id, permisos) => api.patch(`/usuarios/${id}/permisos`, { permisos }),

  getAll: () => api.get('/roles'),
  getById: (id) => api.get(`/roles/${id}`),
  create: (datos) => api.post('/roles', datos),
  update: (id, datos) => api.put(`/roles/${id}`, datos),
  delete: (id) => api.delete(`/roles/${id}`)
};

export default rolService;
