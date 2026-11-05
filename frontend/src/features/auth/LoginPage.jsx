import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import logoHd from '@/assets/logo_hd.png';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedUser = username.trim();
    const trimmedPass = password;

    if (!trimmedUser || !trimmedPass) {
      setError('Por favor complete todos los campos.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(trimmedUser, trimmedPass);
      toast.success('¡Sesión iniciada con éxito!');
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.message || '';
      if (
        msg.toLowerCase().includes('credenciales') ||
        msg.toLowerCase().includes('inválidas') ||
        msg.toLowerCase().includes('incorrectos') ||
        msg.toLowerCase().includes('401')
      ) {
        setError('Usuario o contraseña incorrectos.');
      } else {
        setError(msg || 'Usuario o contraseña incorrectos.');
      }
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const usuarioDev = {
      id: 'dev',
      nombre: 'Admin',
      apellido: 'Demo',
      email: 'admin@demo.com',
      es_admin: true,
      permisos: ['all']
    };
    const tokenDev = 'demo-token-dev';

    localStorage.setItem('token', tokenDev);
    localStorage.setItem('usuario', JSON.stringify(usuarioDev));
    toast.success('Ingresando en Modo Demo (Devs)');
    window.location.href = '/';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 md:p-12"
      style={{ backgroundColor: 'rgb(243, 229, 220)' }}
    >
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-[1200px] justify-center items-center">
        {/* ── Card izquierda: Logo ── */}
        <Card
          className="w-full md:w-1/2 rounded-[2rem] overflow-hidden shadow-lg relative flex-shrink-0 border-0 ring-0 p-0 py-0 gap-0"
          style={{
            aspectRatio: '1.45',
            backgroundColor: '#4a2510'
          }}
        >
          <img
            src={logoHd}
            alt="Andén — Café de especialidad al paso"
            className="w-full h-full object-cover object-center absolute inset-0"
          />
        </Card>

        {/* ── Card derecha: Formulario ── */}
        <Card
          className={cn(
            "w-full md:w-1/2 rounded-[2rem] p-8 md:p-12 flex flex-col justify-center shadow-lg relative flex-shrink-0 scale-95 border-0 ring-0 gap-0 text-white",
            isShaking && "animate-[shake_0.4s_ease-in-out]"
          )}
          style={{
            backgroundColor: '#8a6d5c',
            aspectRatio: '1.45'
          }}
        >
          <CardTitle className="text-2xl md:text-3xl font-bold mb-8 text-white font-sans tracking-normal">
            Iniciar sesión
          </CardTitle>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label
                htmlFor="username"
                className="block text-sm font-semibold mb-2"
                style={{ color: '#d8bcae' }}
              >
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="ejemplo@mail.com"
                autoComplete="username"
                disabled={loading}
                className="w-full !h-auto rounded-xl px-4 py-3.5 text-sm border-0 border-transparent focus-visible:ring-0 shadow-inner transition-all"
                style={{
                  backgroundColor: '#eff5ff',
                  color: '#3b1f0e'
                }}
              />
            </div>

            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-semibold mb-2"
                style={{ color: '#d8bcae' }}
              >
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full !h-auto rounded-xl px-4 py-3.5 pr-12 text-sm border-0 border-transparent focus-visible:ring-0 shadow-inner transition-all"
                  style={{
                    backgroundColor: '#eff5ff',
                    color: '#3b1f0e'
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 !h-8 !w-8 hover:bg-transparent text-[#a68b7c] hover:text-[#8a6d5c] focus-visible:ring-0 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-100 text-sm bg-red-900/60 border border-red-800 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full !h-auto text-white font-bold rounded-xl py-3.5 text-sm transition-all shadow-md hover:shadow-lg active:scale-[0.98] mt-4 border-0 cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#a65129' }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#8c4322';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#a65129';
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Ingresando...</span>
                </>
              ) : (
                'Ingresar'
              )}
            </Button>

            <Button
              type="button"
              onClick={handleDemoLogin}
              className="w-full !h-auto text-black font-bold rounded-xl py-3 text-xs transition-all border-0 mt-3 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.98]"
              style={{ backgroundColor: '#eff5ff', color: '#000000' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#d8bcae';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#eff5ff';
              }}
            >
              Ingreso Admin — Modo Demo (Devs)
            </Button>
          </form>
        </Card>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

export default LoginPage;

