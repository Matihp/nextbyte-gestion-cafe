import api from './api';

export const authService = {
  iniciarSesion: (email, contrasena) => api.post('/auth/login', { email, contrasena }),
  obtenerUsuarioActual: () => api.get('/auth/me'),
  cerrarSesion: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  },
  login: (email, contrasena) => api.post('/auth/login', { email, contrasena }),
  getMe: () => api.get('/auth/me'),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  }
};

export default authService;
