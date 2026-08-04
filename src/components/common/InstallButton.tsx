import { Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface InstallButtonProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export function InstallButton({ variant = 'icon', className = '' }: InstallButtonProps) {
  const { canInstall, isInstalled, handleInstall } = usePWAInstall();

  if (isInstalled || !canInstall) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleInstall}
        className={`btn-icon hover:bg-primary-100 dark:hover:bg-primary-900/30 ${className}`}
        title="Instalar aplicación"
        aria-label="Instalar aplicación"
      >
        <Download className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      </button>
    );
  }

  return (
    <button
      onClick={handleInstall}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors ${className}`}
    >
      <Download className="w-4 h-4" />
      Instalar App
    </button>
  );
}
