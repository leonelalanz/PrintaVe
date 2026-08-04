import { useState, useEffect } from 'react';
import { Check, X, CreditCard, Clock, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBCVRate } from '../../hooks/useBCVRate';
import { LoadingCard } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ESTADOS_PEDIDO_LABELS, METODOS_PAGO_LABELS } from '../../types';
import type { Pedido, Configuracion } from '../../types';

export function PagosPage() {
  const { user } = useAuth();
  const { rate: tasaBcvApi } = useBCVRate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'verificados'>('pendientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filtro]);

  const fetchData = async () => {
    let query = supabase
      .from('pedidos')
      .select('*, cliente:perfiles!pedidos_cliente_id_fkey(*), servicio:servicios(*), zona:zonas(*)')
      .not('estado', 'eq', 'por_revisar')
      .order('created_at', { ascending: false });

    if (filtro === 'pendientes') {
      query = query.eq('estado', 'pago_por_verificar');
    } else if (filtro === 'verificados') {
      query = query.eq('pago_verificado', true);
    }

    const { data, error } = await query;

    if (!error && data) {
      setPedidos(data as Pedido[]);
    }

    const { data: configData } = await supabase
      .from('configuracion')
      .select('*')
      .maybeSingle();
    if (configData) setConfig(configData as Configuracion);

    setLoading(false);
  };

  const handleVerificarPago = async (aprobado: boolean) => {
    if (!selectedPedido || !user) return;

    setProcesando(true);

    const nuevoEstado = aprobado ? 'en_proceso' : 'rechazado';

    const { error } = await supabase
      .from('pedidos')
      .update({
        estado: nuevoEstado,
        pago_verificado: aprobado,
        verificado_por: user.id,
        fecha_inicio_proceso: aprobado ? new Date().toISOString() : null,
      })
      .eq('id', selectedPedido.id);

    if (!error) {
      // Crear notificación
      await supabase.from('notificaciones').insert({
        usuario_id: selectedPedido.cliente_id,
        tipo: aprobado ? 'pago_aprobado' : 'pago_rechazado',
        titulo: aprobado ? 'Pago Verificado' : 'Pago Rechazado',
        mensaje: aprobado
          ? `Tu pago para "${selectedPedido.titulo}" ha sido verificado. Tu pedido está en proceso.`
          : `Hubo un problema con el pago de tu pedido "${selectedPedido.titulo}". Por favor revisa los datos.`,
        data: { pedido_id: selectedPedido.id },
      });

      setSelectedPedido(null);
      fetchData();
    }

    setProcesando(false);
  };

  const filteredPedidos = pedidos.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.titulo.toLowerCase().includes(term) ||
      p.referencia_pago?.toLowerCase().includes(term) ||
      p.cliente?.nombre_completo?.toLowerCase().includes(term)
    );
  });

  const formatBs = (usd: number) => {
    const tasaActual = tasaBcvApi || config?.tasa_bcv || 36.5;
    return (usd * tasaActual).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Validación de Pagos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Verifica y aprueba los pagos de los clientes
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
            placeholder="Buscar por título, referencia o cliente..."
          />
        </div>
        <div className="flex gap-2">
          {(['pendientes', 'verificados', 'todos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filtro === f
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              {f === 'pendientes' && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Pendientes
                </span>
              )}
              {f === 'verificados' && 'Verificados'}
              {f === 'todos' && 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {filtro === 'pendientes' && (
        <div className="flex items-center gap-4 text-sm">
          <span className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg font-medium">
            {filteredPedidos.length} pagos pendientes de verificación
          </span>
        </div>
      )}

      {/* List */}
      <div className="card divide-y divide-gray-200 dark:divide-gray-800">
        {filteredPedidos.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay pagos para mostrar</p>
          </div>
        ) : (
          filteredPedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              onClick={() => setSelectedPedido(pedido)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{pedido.titulo}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {pedido.cliente?.nombre_completo}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <StatusBadge status={pedido.estado} />
                    <span className="text-xs text-gray-400">
                      {pedido.fecha_pago ? new Date(pedido.fecha_pago).toLocaleString('es-VE') : 'Sin fecha'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 dark:text-white">
                    ${pedido.monto_usd.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {config && `Bs. ${formatBs(pedido.monto_usd)}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {pedido.metodo_pago && METODOS_PAGO_LABELS[pedido.metodo_pago]}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedPedido && (
        <Modal
          isOpen={!!selectedPedido}
          onClose={() => setSelectedPedido(null)}
          title="Detalle del Pago"
          size="lg"
        >
          <div className="space-y-4">
            {/* Order Info */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
              <p className="font-medium text-gray-900 dark:text-white">{selectedPedido.titulo}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cliente: {selectedPedido.cliente?.nombre_completo}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Servicio: {selectedPedido.servicio?.nombre}
              </p>
            </div>

            {/* Payment Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monto USD</p>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  ${selectedPedido.monto_usd.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monto en Bolívares</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  Bs. {formatBs(selectedPedido.monto_usd)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Tasa BCV: {(tasaBcvApi || config?.tasa_bcv || 36.5).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  {tasaBcvApi && config && tasaBcvApi !== config.tasa_bcv && (
                    <span className="text-green-600 dark:text-green-400"> (API en tiempo real)</span>
                  )}
                </p>
              </div>
            </div>

            {/* Payment Method & Reference */}
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Método: <span className="font-medium text-gray-900 dark:text-white">{selectedPedido.metodo_pago && METODOS_PAGO_LABELS[selectedPedido.metodo_pago]}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Referencia de Pago:</p>
                <p className="font-mono text-lg font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                  {selectedPedido.referencia_pago || 'No proporcionada'}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Fecha: {selectedPedido.fecha_pago ? new Date(selectedPedido.fecha_pago).toLocaleString('es-VE') : 'N/A'}
              </p>
            </div>

            {/* Status */}
            {selectedPedido.pago_verificado && (
              <div className="p-3 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 rounded-xl text-sm font-medium">
                Pago verificado el {selectedPedido.fecha_inicio_proceso && new Date(selectedPedido.fecha_inicio_proceso).toLocaleDateString('es-VE')}
              </div>
            )}

            {/* Actions */}
            {selectedPedido.estado === 'pago_por_verificar' && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleVerificarPago(false)}
                  disabled={procesando}
                  className="btn-danger flex-1"
                >
                  <X className="w-4 h-4" />
                  Rechazar
                </button>
                <button
                  onClick={() => handleVerificarPago(true)}
                  disabled={procesando}
                  className="btn-success flex-1"
                >
                  <Check className="w-4 h-4" />
                  {procesando ? 'Verificando...' : 'Aprobar Pago'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
