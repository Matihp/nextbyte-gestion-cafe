import api from './api';

export const productoService = {
  obtenerCategorias: () => api.get('/categorias'),
  crearCategoria: (datos) => api.post('/categorias', datos),
  actualizarCategoria: (id, datos) => api.put(`/categorias/${id}`, datos),
  eliminarCategoria: (id) => api.delete(`/categorias/${id}`),

  obtenerProductos: (params = {}) => api.get('/productos', { params: { _t: Date.now(), ...params } }),
  obtenerProductoPorId: (id) => api.get(`/productos/${id}`),
  crearProducto: (datos) => api.post('/productos', datos),
  actualizarProducto: (id, datos) => api.put(`/productos/${id}`, datos),
  eliminarProducto: (id, motivo, cantidad) => api.delete(`/productos/${id}`, { data: { motivo, cantidad } }),

  obtenerReceta: (productoId) => api.get(`/productos/${productoId}/receta`),
  guardarReceta: (productoId, datos) => api.put(`/productos/${productoId}/receta`, datos),
  eliminarReceta: (productoId) => api.delete(`/productos/${productoId}/receta`),

  getCategorias: () => api.get('/categorias'),
  getProductos: (params = {}) => api.get('/productos', { params: { _t: Date.now(), ...params } })
};

export default productoService;
