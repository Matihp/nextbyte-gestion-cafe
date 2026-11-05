import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './features/dashboard/Home';
import Pedidos from './features/pedidos/Pedidos';
import Productos from './features/menu/Productos';
import Estadisticas from './features/reportes/Estadisticas';
import ReporteCaja from './features/caja/ReporteCaja';
import EmployeesPage from './features/empleados/EmployeesPage';
import OrdersPage from './features/comandas/OrdersPage';
import InventoryPage from './features/inventario/InventoryPage';
import SuppliersPage from './features/inventario/SuppliersPage';
import CustomerViewerPage from './features/clientes/CustomerViewerPage';
import LoginPage from './features/auth/LoginPage';
import Configuracion from './features/configuracion/Configuracion';
import { Toaster } from './components/ui/sonner';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/comandas" element={<OrdersPage />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/empleados" element={<EmployeesPage />} />
          <Route path="/caja" element={<ReporteCaja />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          <Route path="/pantalla-cliente" element={<CustomerViewerPage />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/settings" element={<Configuracion />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
