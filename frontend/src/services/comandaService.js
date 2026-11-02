import api from './api';

export const comandaService = {
  obtenerActivas: () => api.get('/comandas/activas'),
  cambiarEstado: (id, estado) => api.patch(`/comandas/${id}/estado`, { estado }),
  completar: (id) => api.patch(`/comandas/${id}/completar`),

  getActivas: () => api.get('/comandas/activas')
};

export default comandaService;
