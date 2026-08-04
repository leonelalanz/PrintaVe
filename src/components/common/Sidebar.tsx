import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  MapPin,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { InstallButton } from './InstallButton';
import { Logo } from './Logo';
import type { RolUsuario } from '../../types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  roles: RolUsuario[];
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['superadmin', 'empleado', 'cliente'] },
  { path: '/pedidos', label: 'Pedidos', icon: FileText, roles: ['superadmin', 'empleado'] },
  { path: '/mis-pedidos', label: 'Mis Pedidos', icon: FileText, roles: ['cliente'] },
  { path: '/nuevo-pedido', label: 'Nueva Tarea', icon: FileText, roles: ['cliente'] },
  { path: '/pagos', label: 'Validar Pagos', icon: CreditCard, roles: ['superadmin'] },
  { path: '/empleados', label: 'Empleados', icon: Users, roles: ['superadmin'] },
  { path: '/zonas', label: 'Zonas', icon: MapPin, roles: ['superadmin'] },
  { path: '/precios', label: 'Precios', icon: DollarSign, roles: ['superadmin'] },
  { path: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['superadmin', 'empleado'] },
  { path: '/configuracion', label: 'Configuración', icon: Settings, roles: ['superadmin'] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const filteredItems = navItems.filter((item) => user && item.roles.includes(user.rol));

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          {!collapsed && (
            <Logo showText={true} size="sm" />
          )}
          {collapsed && (
            <Logo showText={false} size="sm" />
          )}
          <button
            onClick={onToggle}
            className="btn-icon ml-auto"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
          <ul className="space-y-1 px-3">
            {filteredItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          {!collapsed && user && (
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.nombre_completo}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user.rol.replace('_', ' ')}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <InstallButton variant={collapsed ? 'icon' : 'full'} className={collapsed ? 'w-full justify-center' : ''} />
            <button
              onClick={signOut}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20 transition-colors ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut className="w-5 h-5" />
              {!collapsed && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
