import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { MainLayout, AuthLayout } from './components/common/Layout';
import { LoadingPage } from './components/common/Loading';

// Auth pages
import { LoginPage } from './pages/auth/Login';
import { RegisterPage } from './pages/auth/Register';

// Shared pages
import { DashboardPage } from './pages/Dashboard';
import { ReportesPage } from './pages/ReportesPage';

// Superadmin pages
import { ConfiguracionPage } from './pages/superadmin/ConfiguracionPage';
import { PreciosPage } from './pages/superadmin/PreciosPage';
import { PagosPage } from './pages/superadmin/PagosPage';
import { ZonasPage } from './pages/superadmin/ZonasPage';
import { EmpleadosPage } from './pages/superadmin/EmpleadosPage';

// Empleado pages
import { PedidosEmpleadoPage } from './pages/empleado/PedidosEmpleadoPage';

// Cliente pages
import { MisPedidosPage } from './pages/cliente/MisPedidosPage';
import { NuevoPedidoPage } from './pages/cliente/NuevoPedidoPage';

import type { RolUsuario } from './types';

// Protected Route Component
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: RolUsuario[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Public Route (redirect if logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingPage />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
      </Route>

      {/* Main app routes */}
      <Route element={<MainLayout />}>
        {/* Dashboard - All roles */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Pedidos - Superadmin & Empleado */}
        <Route
          path="/pedidos"
          element={
            <ProtectedRoute allowedRoles={['superadmin', 'empleado']}>
              <PedidosEmpleadoPage />
            </ProtectedRoute>
          }
        />

        {/* Pagos - Superadmin */}
        <Route
          path="/pagos"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <PagosPage />
            </ProtectedRoute>
          }
        />

        {/* Empleados - Superadmin */}
        <Route
          path="/empleados"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <EmpleadosPage />
            </ProtectedRoute>
          }
        />

        {/* Zonas - Superadmin */}
        <Route
          path="/zonas"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <ZonasPage />
            </ProtectedRoute>
          }
        />

        {/* Precios - Superadmin */}
        <Route
          path="/precios"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <PreciosPage />
            </ProtectedRoute>
          }
        />

        {/* Configuracion - Superadmin */}
        <Route
          path="/configuracion"
          element={
            <ProtectedRoute allowedRoles={['superadmin']}>
              <ConfiguracionPage />
            </ProtectedRoute>
          }
        />

        {/* Reportes - Superadmin & Empleado */}
        <Route
          path="/reportes"
          element={
            <ProtectedRoute allowedRoles={['superadmin', 'empleado']}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />

        {/* Mis Pedidos - Cliente */}
        <Route
          path="/mis-pedidos"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <MisPedidosPage />
            </ProtectedRoute>
          }
        />

        {/* Nuevo Pedido - Cliente */}
        <Route
          path="/nuevo-pedido"
          element={
            <ProtectedRoute allowedRoles={['cliente']}>
              <NuevoPedidoPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <AppRoutes />
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
