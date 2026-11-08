import api from './api';

export const comandaService = {
  obtenerActivas: (params) => api.get('/comandas/activas', { params }),
  cambiarEstado: (id, estado) => api.patch(`/comandas/${id}/estado`, { estado }),
  completar: (id) => api.patch(`/comandas/${id}/completar`),
  entregar: (id) => api.patch(`/comandas/${id}/entregar`),

  getActivas: (params) => api.get('/comandas/activas', { params })
};

export default comandaService;
