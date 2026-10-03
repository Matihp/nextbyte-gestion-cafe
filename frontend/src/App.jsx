import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './features/dashboard/Home';

function App() {
  return (
    <Routes>
      {/* RUTAS PÚBLICAS (No tienen el Menú Lateral) */}
      {/* 
        NOTA: Aca debe ir la ruta de login 
      */}

      {/* RUTAS PRIVADAS (Tienen el Menú Lateral del Layout) */}
      <Route element={<DashboardLayout />}>
        {/* Cualquier ruta aca adentro, aparecerá al lado del Sidebar */}
        <Route path="/" element={<Home />} />
      </Route>
    </Routes>
  );
}

export default App;
