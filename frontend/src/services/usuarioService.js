import api from './api';

export const usuarioService = {
  getAll: async () => {
    const res = await api.get('/usuarios');
    return res.data?.data || res.data || [];
  },

  getById: async (id) => {
    const res = await api.get(`/usuarios/${id}`);
    return res.data?.data || res.data;
  },

  create: async (datos) => {
    const res = await api.post('/usuarios', datos);
    return res.data?.data || res.data;
  },

  update: async (id, datos) => {
    const res = await api.put(`/usuarios/${id}`, datos);
    return res.data?.data || res.data;
  },

  delete: async (id) => {
    const res = await api.delete(`/usuarios/${id}`);
    return res.data?.data || res.data;
  },

  cambiarRol: async (id, rolId) => {
    const res = await api.patch(`/usuarios/${id}/rol`, { rol_id: rolId });
    return res.data?.data || res.data;
  },

  cambiarPermisos: async (id, permisos) => {
    const res = await api.patch(`/usuarios/${id}/permisos`, { permisos });
    return res.data?.data || res.data;
  }
};

export default usuarioService;

