import api from './api';

export const reporteService = {
  obtenerResumen: () => api.get('/reportes/resumen'),
  obtenerVentasDia: () => api.get('/reportes/ventas-dia'),
  obtenerVentasRango: (params = {}) => api.get('/reportes/ventas-rango', { params }),
  obtenerTopProductos: (params = {}) => api.get('/reportes/top-productos', { params }),
  obtenerGanancias: (params = {}) => api.get('/reportes/ganancias', { params }),
  obtenerMermas: (params = {}) => api.get('/reportes/mermas', { params }),
  obtenerEstadisticas: (params = {}) => api.get('/reportes/estadisticas', { params }),

  getResumen: () => api.get('/reportes/resumen'),
  getVentasDia: () => api.get('/reportes/ventas-dia'),
  getEstadisticas: (params = {}) => api.get('/reportes/estadisticas', { params })
};

export default reporteService;
