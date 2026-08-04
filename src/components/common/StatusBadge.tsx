import type { EstadoPedido } from '../../types';
import { ESTADOS_PEDIDO_LABELS, ESTADOS_PEDIDO_COLORS } from '../../types';

interface StatusBadgeProps {
  status: EstadoPedido | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  // Mapeo de estados antiguos a nuevos
  const estadoMapeado = status === 'listo_para_retirar' ? 'listo_para_entregar' : status;

  const label = ESTADOS_PEDIDO_LABELS[estadoMapeado as EstadoPedido] || estadoMapeado;
  const color = ESTADOS_PEDIDO_COLORS[estadoMapeado as EstadoPedido] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`badge ${color}`}>
      {label}
    </span>
  );
}
