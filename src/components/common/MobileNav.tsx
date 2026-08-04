import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Plus,
  User,
  Menu,
  X,
  LogOut,
  Settings,
  BarChart3,
  Users,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { InstallButton } from './InstallButton';
import type { RolUsuario } from '../../types';

const navByRole: Record<RolUsuario, { path: string; label: string; icon: React.ElementType }[]> = {
  superadmin: [
    { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { path: '/pedidos', label: 'Pedidos', icon: FileText },
    { path: '/pagos', label: 'Pagos', icon: CreditCard },
    { path: '/empleados', label: 'Empleados', icon: Users },
    { path: '/zonas', label: 'Zonas', icon: MapPin },
    { path: '/reportes', label: 'Reportes', icon: BarChart3 },
    { path: '/configuracion', label: 'Config', icon: Settings },
  ],
  empleado: [
    { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { path: '/pedidos', label: 'Pedidos', icon: FileText },
    { path: '/reportes', label: 'Reportes', icon: BarChart3 },
  ],
  cliente: [
    { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { path: '/mis-pedidos', label: 'Pedidos', icon: FileText },
    { path: '/nuevo-pedido', label: 'Nueva', icon: Plus },
    { path: '/perfil', label: 'Perfil', icon: User },
  ],
};

export function MobileNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = user ? navByRole[user.rol] : [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50 lg:hidden">
        <div className="flex items-center justify-between h-full px-4">
          <Logo size="sm" />

          <div className="flex items-center gap-2">
            <NotificationBell />
            <InstallButton />
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen(true)}
              className="btn-icon"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom navigation (tabs) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 lg:hidden safe-area-pb">
        <div className="flex items-center justify-around h-full max-w-md mx-auto">
          {navItems.slice(0, 4).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Slide-out menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-gray-900 shadow-xl animate-slide-down">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <Logo size="sm" />
              <button
                onClick={() => setMenuOpen(false)}
                className="btn-icon"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {user && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <p className="font-medium text-gray-900 dark:text-white">
                  {user.nombre_completo}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {user.rol === 'superadmin' ? 'Super Admin' : user.rol}
                </p>
              </div>
            )}

            <nav className="p-4">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
