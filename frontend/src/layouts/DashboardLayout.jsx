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
import { useAuth } from '@/hooks/useAuth';
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
  User
} from 'lucide-react';
import logo from '../assets/logo.png';

const menuItems = [
  { title: "Panel", url: "/", icon: LayoutDashboard },
  { title: "Pedidos", url: "/pedidos", icon: ClipboardList },
  { title: "Comandas", url: "/comandas", icon: UtensilsCrossed },
  { title: "Productos", url: "/productos", icon: Package },
  { title: "Inventario", url: "/inventario", icon: ShoppingCart },
  { title: "Empleados", url: "/empleados", icon: Users },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
  { title: "Caja", url: "/caja", icon: Calculator },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
  { title: "Pantalla Cliente", url: "/pantalla-cliente", icon: MonitorPlay },
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
      <div className="flex h-screen max-h-screen w-full bg-background overflow-hidden">
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
                  {menuItems.map((item) => {
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
          <header className="flex justify-between items-center px-8 py-4 border-b border-primary/10 bg-background relative z-10 w-full shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-tight">{currentTitle}</h1>
              <p className="text-sm text-secondary font-medium mt-0.5">Hola, {user?.nombre || 'Usuario'}</p>
            </div>

            <div className="flex items-center gap-4">
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
      </div>
    </SidebarProvider>
  );
}
