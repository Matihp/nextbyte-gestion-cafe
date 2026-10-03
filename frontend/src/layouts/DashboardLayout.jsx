import { Outlet, Link } from 'react-router-dom';
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Home, Package, ShoppingCart } from 'lucide-react';

const menuItems = [
  { title: "Panel", url: "/", icon: Home },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart },
  { title: "Comandas", url: "/comandas", icon: Package },
  { title: "Productos", url: "/productos", icon: Package },
  { title: "Inventario", url: "/inventario", icon: Package },
  { title: "Empleados", url: "/empleados", icon: Package },
  { title: "Proveedores", url: "/proveedores", icon: Package },
  { title: "Caja", url: "/caja", icon: Package },
  { title: "Estadísticas", url: "/estadisticas", icon: Package },
  { title: "Pantalla Clientes", url: "/clientes", icon: Package },
]

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>NextByte Gestión</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* El Contenido Principal */}
        <main className="flex-1 overflow-auto p-6">
          {/* El Outlet es el agujero donde React insertará las demás pantallas */}
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
