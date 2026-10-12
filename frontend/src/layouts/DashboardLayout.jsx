import { Outlet, NavLink, useLocation } from 'react-router-dom';
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Fija a la izquierda */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-primary text-primary-foreground shadow-xl flex flex-col z-40">
        {/* Logo Andén */}
        <div className="p-6 pb-4 flex items-center justify-center">
          <img 
            src={logo} 
            alt="Logo Andén" 
            className="w-full h-auto object-contain drop-shadow-md rounded-lg" 
          />
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.url === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(item.url);

            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-accent text-accent-foreground shadow-sm' 
                    : 'text-primary-foreground/90 hover:bg-accent/40 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
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
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
