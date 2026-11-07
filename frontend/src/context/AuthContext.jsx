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
        } catch (err) {
          const status = err?.status ?? err?.response?.status;
          const isExplicit401 = status === 401;

          if (isExplicit401) {
            authService.logout();
            setUser(null);
            setToken(null);
          } else {
            // Error de red / offline: preservar la sesión activa de localStorage
            const guardado = localStorage.getItem('usuario');
            if (guardado) {
              try {
                setUser(JSON.parse(guardado));
              } catch {
                // mantener usuario actual
              }
            }
          }
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

  const updateUser = (nuevosDatos) => {
    setUser((prev) => {
      if (!prev) return nuevosDatos;
      const actualizado = { ...prev, ...nuevosDatos };
      localStorage.setItem('usuario', JSON.stringify(actualizado));
      return actualizado;
    });
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    isAdmin: Boolean(user?.es_admin),
    login,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
