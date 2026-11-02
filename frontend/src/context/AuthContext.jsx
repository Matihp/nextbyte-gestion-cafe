import { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const guardado = localStorage.getItem('usuario');
    try {
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarSesion = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const usuarioData = await authService.getMe();
          setUser(usuarioData);
          localStorage.setItem('usuario', JSON.stringify(usuarioData));
        } catch {
          authService.logout();
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    };

    verificarSesion();
  }, []);

  const login = async (email, contrasena) => {
    const data = await authService.login(email, contrasena);
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setToken(data.token);
    setUser(data.usuario);
    return data.usuario;
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    isAdmin: Boolean(user?.es_admin),
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
