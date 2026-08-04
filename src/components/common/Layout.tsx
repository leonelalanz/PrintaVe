import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { Logo } from './Logo';
import { useAuth } from '../../contexts/AuthContext';

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Mobile navigation */}
      <MobileNav />

      {/* Main content */}
      <main
        className={`min-h-screen transition-all duration-300 pt-14 pb-20 lg:pt-0 lg:pb-0 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        } lg:hidden`}
      >
        <div className="p-4 lg:p-0">
          <Outlet />
        </div>
      </main>

      {/* Desktop header and content */}
      <div
        className={`hidden lg:block transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {/* Header */}
        <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-6 gap-4">
          <NotificationBell />
          <ThemeToggle />
        </div>

        {/* Content */}
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Outlet />
      </div>
    </div>
  );
}
