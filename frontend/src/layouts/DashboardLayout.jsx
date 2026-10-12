import { Outlet, Link, useLocation } from 'react-router-dom';
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
  '/estadisticas': 'Estadísticas',
  '/pantalla-cliente': 'Pantalla Cliente',
  '/clientes': 'Pantalla Cliente',
};

export default function DashboardLayout() {
  const location = useLocation();
  const currentTitle = pageTitles[location.pathname] || 'Panel';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
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
          <SidebarContent className="px-4 py-2">
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

        {/* Contenedor Principal */}
        <SidebarInset className="flex-1 flex flex-col min-h-screen bg-background">
          {/* Header Superior */}
          <header className="flex justify-between items-center px-8 py-5 border-b border-primary/10 bg-background relative z-30">
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-tight">{currentTitle}</h1>
              <p className="text-sm text-secondary font-medium mt-0.5">Hola, Usuario</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-primary">Usuario</p>
                <p className="text-xs text-accent font-semibold">Usuario</p>
              </div>
              <div className="relative group cursor-pointer">
                <div className="w-11 h-11 rounded-full border border-primary/20 shadow-sm bg-accent text-accent-foreground flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
              </div>
            </div>
          </header>

          {/* Contenido de la Pantalla Actual (Lienzo limpio con fondo bg-background) */}
          <div className="flex-1 p-8 overflow-y-auto bg-background">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
