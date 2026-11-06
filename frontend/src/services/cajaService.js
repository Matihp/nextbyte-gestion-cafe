import api from './api';

export const cajaService = {
  obtenerMovimientos: (params = {}) => api.get('/caja/movimientos', { params }),
  crearMovimiento: (datos) => api.post('/caja/movimientos', datos),
  eliminarMovimiento: (id) => api.delete(`/caja/movimientos/${id}`),

  obtenerSaldoAnterior: (mes) => api.get('/caja/saldo-anterior', { params: { mes } }),
  obtenerMermasMes: (mes) => api.get('/caja/mermas-mes', { params: { mes } }),
};

export default cajaService;

