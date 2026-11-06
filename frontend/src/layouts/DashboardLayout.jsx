import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader,
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarInset
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ROLES_SISTEMA } from '@/constants/roles';
import { 
  LayoutDashboard, 
  ClipboardList, 
  UtensilsCrossed, 
  Package, 
  ShoppingCart, 
  Users, 
  Truck, 
  Calculator, 
  BarChart3, 
  MonitorPlay,
  User,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import logo from '../assets/logo.png';

const menuItems = [
  { title: "Panel", url: "/", icon: LayoutDashboard, permission: 'dashboard' },
  { title: "Pedidos", url: "/pedidos", icon: ClipboardList, permission: 'orderTaking' },
  { title: "Comandas", url: "/comandas", icon: UtensilsCrossed, permission: 'orders' },
  { title: "Productos", url: "/productos", icon: Package, permission: 'products' },
  { title: "Inventario", url: "/inventario", icon: ShoppingCart, permission: 'inventory' },
  { title: "Empleados", url: "/empleados", icon: Users, permission: 'employees' },
  { title: "Proveedores", url: "/proveedores", icon: Truck, permission: 'suppliers' },
  { title: "Caja", url: "/caja", icon: Calculator, permission: 'salesReport' },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3, permission: 'analytics' },
  { title: "Pantalla Cliente", url: "/pantalla-cliente", icon: MonitorPlay, permission: 'customerViewer' },
];

const pageTitles = {
  '/': 'Panel',
  '/pedidos': 'Pedidos',
  '/comandas': 'Comandas',
  '/productos': 'Productos',
  '/inventario': 'Inventario',
  '/empleados': 'Empleados',
  '/proveedores': 'Proveedores',
  '/caja': 'Caja',
  '/salesReport': 'Caja',
  '/estadisticas': 'Estadísticas',
  '/pantalla-cliente': 'Pantalla Cliente',
  '/configuracion': 'Configuración',
  '/settings': 'Configuración',
};

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const currentTitle = pageTitles[location.pathname] || 'Panel';
  const isNoScroll = location.pathname === '/pedidos' || location.pathname === '/pantalla-cliente';

  const userPermissions = Array.isArray(user?.permisos)
    ? user.permisos
    : typeof user?.permisos === 'string'
    ? (() => { try { return JSON.parse(user.permisos); } catch { return []; } })()
    : [];

  const esAdmin = Boolean(user?.es_admin || userPermissions.includes('all'));

  const visibleMenuItems = menuItems.filter((item) => {
    if (esAdmin) return true;
    if (!item.permission) return true;
    return userPermissions.includes(item.permission);
  });

  const tieneAccesoConfiguracion = esAdmin || userPermissions.includes('settings') || userPermissions.includes('canCreateRoles');

  const esCajeroContingencia = Boolean(
    user?.es_contingencia ||
    user?.rol_id === ROLES_SISTEMA.CAJERO_PRINCIPAL ||
    user?.rol_id === 'role-caja-contingencia'
  );

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [checkingConnection, setCheckingConnection] = useState(false);
  const wasOfflineRef = useRef(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setShowRestoredBanner(true);
        wasOfflineRef.current = false;
      }
      toast.success('Conexión a internet restablecida');
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setShowRestoredBanner(false);
      toast.error('Se ha perdido la conexión a internet. Modo Contingencia activado.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleNetworkEvent = (e) => {
      if (e.detail?.online !== undefined) {
        const online = Boolean(e.detail.online);
        setIsOnline(online);
        if (!online) {
          wasOfflineRef.current = true;
          setShowRestoredBanner(false);
        } else if (wasOfflineRef.current) {
          setShowRestoredBanner(true);
          wasOfflineRef.current = false;
        }
      }
    };
    window.addEventListener('nextbyte:network-status', handleNetworkEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('nextbyte:network-status', handleNetworkEvent);
    };
  }, []);

  const handleReintentarConexion = async () => {
    setCheckingConnection(true);
    try {
      if (!navigator.onLine) {
        toast.error('La aplicación continúa sin conexión a internet');
        setIsOnline(false);
        wasOfflineRef.current = true;
        setShowRestoredBanner(false);
        setCheckingConnection(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiUrl}/health`, { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.isOnline === false) {
          setIsOnline(false);
          wasOfflineRef.current = true;
          setShowRestoredBanner(false);
          toast.info('Servidor local activo en Modo Contingencia.');
        } else {
          setIsOnline(true);
          if (wasOfflineRef.current) {
            setShowRestoredBanner(true);
            wasOfflineRef.current = false;
          }
          toast.success('Conexión restablecida con éxito');
        }
      } else {
        setIsOnline(false);
        wasOfflineRef.current = true;
        setShowRestoredBanner(false);
        toast.warning('Servidor temporalmente no disponible');
      }
    } catch {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setShowRestoredBanner(false);
      toast.error('No se pudo conectar con el servidor. Sigue en Modo Contingencia.');
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const nombreMostrado = user?.nombre
    ? `${user.nombre} ${user.apellido || ''}`.trim()
    : 'Usuario';
  const rolMostrado = user?.es_admin ? 'Admin' : 'Personal';

  return (
    <SidebarProvider>
      <div className="flex h-screen max-h-screen w-full bg-background overflow-hidden relative">
        <Sidebar className="border-r border-sidebar-border/20 bg-sidebar text-sidebar-foreground">
          {/* Logo Andén */}
          <SidebarHeader className="p-6 pb-4 flex items-center justify-center">
            <img 
              src={logo} 
              alt="Logo Andén" 
              className="w-full h-auto object-contain drop-shadow-md rounded-lg" 
            />
          </SidebarHeader>

          {/* Menú de Navegación */}
          <SidebarContent className="px-4 py-2 no-scrollbar">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1.5">
                  {visibleMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.url === '/' 
                      ? location.pathname === '/' 
                      : location.pathname.startsWith(item.url);

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          render={<Link to={item.url} className="w-full flex flex-row items-center gap-3.5" />}
                          size="lg"
                          isActive={isActive}
                          className={`w-full !h-12 !flex !flex-row !items-center !gap-3.5 !px-4 !py-3 !rounded-xl text-sm font-medium transition-colors ${
                            isActive 
                              ? '!bg-accent !text-accent-foreground shadow-sm' 
                              : 'text-sidebar-foreground/90 hover:!bg-accent/40 hover:!text-white'
                          }`}
                        >
                          <Link to={item.url} className="w-full flex flex-row items-center gap-3.5">
                            <Icon className="!w-5 !h-5 !size-5 shrink-0" />
                            <span className="text-sm font-medium whitespace-nowrap">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Contenedor Principal (Bloqueado a la altura de la pantalla, sin scroll global) */}
        <SidebarInset className="flex-1 flex flex-col h-screen max-h-screen bg-background min-w-0 max-w-full overflow-hidden">
          {/* Header Superior Fijo */}
          <header className="flex justify-between items-center px-8 py-4 border-b border-primary/10 bg-background relative z-10 w-full shrink-0 gap-4">
            <div className="shrink-0">
              <h1 className="text-2xl font-bold text-primary tracking-tight">{currentTitle}</h1>
              <p className="text-sm text-secondary font-medium mt-0.5">Hola, {user?.nombre || 'Usuario'}</p>
            </div>

            {/* Cartel en Rojo: Sin conexión / Modo Contingencia para Cajero */}
            {esCajeroContingencia && !isOnline && (
              <div className="mx-2 sm:mx-4 flex-1 max-w-xl bg-red-50 border border-red-300 text-red-900 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <WifiOff className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold truncate">
                    Sin conexión <span className="font-normal opacity-90 hidden md:inline">— Modo Contingencia activo (operando localmente)</span>
                  </span>
                </div>
                <button
                  onClick={handleReintentarConexion}
                  disabled={checkingConnection}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-2.5 py-1 rounded-lg shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Reintentar conexión al servidor"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin' : ''}`} />
                  <span>{checkingConnection ? 'Verificando...' : 'Reintentar'}</span>
                </button>
              </div>
            )}

            {/* Cartel en Azul: Conexión recuperada (se descarta con Aceptar) */}
            {esCajeroContingencia && isOnline && showRestoredBanner && (
              <div className="mx-2 sm:mx-4 flex-1 max-w-xl bg-blue-50 border border-blue-300 text-blue-900 px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <Wifi className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold truncate">
                    Conexión restablecida <span className="font-normal opacity-90 hidden md:inline">— El sistema vuelve a operar con normalidad</span>
                  </span>
                </div>
                <button
                  onClick={() => setShowRestoredBanner(false)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1 rounded-lg shrink-0 transition-colors cursor-pointer"
                  title="Descartar aviso"
                >
                  Aceptar
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-primary">{nombreMostrado}</p>
                <p className="text-xs text-accent font-semibold">{user?.email || rolMostrado}</p>
              </div>

              {/* Menú de Usuario desplegable al hacer clic en el avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-12 h-12 rounded-full bg-[#9F4F2F] text-[#F3E5DC] flex items-center justify-center hover:bg-[#4B2B1D] transition-colors shadow-sm overflow-hidden border border-[#4B2B1D]/10 cursor-pointer focus:outline-none"
                    title="Menú de usuario"
                  >
                    {user?.foto ? (
                      <img src={user.foto} alt={nombreMostrado} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-48 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-[#4B2B1D]/10 p-0 overflow-hidden z-50"
                >
                  <DropdownMenuItem
                    onClick={() => navigate('/configuracion')}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-[#4B2B1D] hover:bg-[#F3E5DC] cursor-pointer rounded-t-xl transition-colors focus:bg-[#F3E5DC] focus:text-[#4B2B1D]"
                  >
                    Configuración
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="m-0 border-t border-[#4B2B1D]/10" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer rounded-b-xl transition-colors focus:bg-red-50 focus:text-red-600"
                  >
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Contenido de la Pantalla Actual */}
          <div className={`flex-1 min-h-0 min-w-0 max-w-full bg-background ${
            isNoScroll 
              ? 'p-4 md:p-6 overflow-hidden flex flex-col' 
              : 'p-6 md:p-8 overflow-y-auto overflow-x-hidden'
          }`}>
            <Outlet />
          </div>
        </SidebarInset>

        {/* Overlay Bloqueante para usuarios que NO son Cajero de Contingencia */}
        {!isOnline && !esCajeroContingencia && (
          <div className="fixed inset-0 z-50 bg-[#4B2B1D]/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-amber-200">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-300">
                <WifiOff className="w-8 h-8 text-amber-700" />
              </div>
              <h2 className="text-2xl font-bold text-[#4B2B1D] mb-2">
                Modo Contingencia Activo
              </h2>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                Se ha perdido la conexión a internet. Para garantizar la consistencia operativa del comercio, <strong>únicamente el Cajero Principal de Contingencia está habilitado para operar</strong> en este momento.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={handleReintentarConexion}
                  disabled={checkingConnection}
                  className="bg-[#9F4F2F] hover:bg-[#8A4326] text-white font-semibold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingConnection ? 'animate-spin' : ''}`} />
                  {checkingConnection ? 'Verificando...' : 'Reintentar conexión'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
