import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBCVRate } from '../hooks/useBCVRate';
import { supabase } from '../lib/supabase';
import { LoadingCard } from '../components/common/Loading';
import { StatusBadge } from '../components/common/StatusBadge';
import type { Pedido, Servicio, Configuracion } from '../types';
import { ESTADOS_PEDIDO_LABELS, TURNOS_ENTREGA_LABELS } from '../types';

interface Stats {
  total_pedidos: number;
  pendientes: number;
  en_proceso: number;
  completados: number;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { rate: tasaBcv, loading: loadingBcv, error: errorBcv, lastUpdated } = useBCVRate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Pedido[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch configuración
      const { data: configData } = await supabase
        .from('configuracion')
        .select('*')
        .maybeSingle();
      if (configData) setConfig(configData as Configuracion);

      // Fetch stats based on role
      if (user.rol === 'cliente') {
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('*, servicio:servicios(*), zona:zonas(*)')
          .eq('cliente_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (pedidos) {
          setRecentOrders(pedidos as Pedido[]);
          setStats({
            total_pedidos: pedidos.length,
            pendientes: pedidos.filter(p => ['por_revisar', 'aprobado_para_pago', 'pago_por_verificar'].includes(p.estado)).length,
            en_proceso: pedidos.filter(p => p.estado === 'en_proceso').length,
            completados: pedidos.filter(p => p.estado === 'entregado').length,
          });
        }
      } else if (user.rol === 'empleado' && user.zona_id) {
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('*, cliente:perfiles!pedidos_cliente_id_fkey(*), servicio:servicios(*), zona:zonas(*)')
          .eq('zona_id', user.zona_id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (pedidos) {
          setRecentOrders(pedidos as Pedido[]);
          setStats({
            total_pedidos: pedidos.length,
            pendientes: pedidos.filter(p => p.estado === 'por_revisar').length,
            en_proceso: pedidos.filter(p => p.estado === 'en_proceso').length,
            completados: pedidos.filter(p => p.estado === 'entregado').length,
          });
        }
      } else if (user.rol === 'superadmin') {
        const { count: total } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true });

        const { count: pendientes } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'pago_por_verificar');

        const { count: enProceso } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'en_proceso');

        const { count: completados } = await supabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'entregado');

        setStats({
          total_pedidos: total || 0,
          pendientes: pendientes || 0,
          en_proceso: enProceso || 0,
          completados: completados || 0,
        });

        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('*, cliente:perfiles!pedidos_cliente_id_fkey(*), servicio:servicios(*), zona:zonas(*)')
          .in('estado', ['por_revisar', 'pago_por_verificar', 'en_proceso'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (pedidos) setRecentOrders(pedidos as Pedido[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (loading) return <LoadingCard />;

  const formatBs = (usd: number, tasa: number) => (usd * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Bienvenido, {user?.nombre_completo?.split(' ')[0]}
          </h1>
        </div>
      </div>

      {/* Tasa BCV Card */}
      <div className="card card-padding bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/10 border border-primary-200 dark:border-primary-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500 rounded-xl">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tasa BCV Actual</p>
              {loadingBcv ? (
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Cargando...</p>
              ) : errorBcv ? (
                <p className="text-sm text-red-600 dark:text-red-400">Error: {errorBcv}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {tasaBcv?.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/USD
                  </p>
                  {lastUpdated && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Actualizado: {lastUpdated.toLocaleTimeString('es-VE')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <p className="stat-value">{stats.total_pedidos}</p>
            <p className="stat-label">Total Pedidos</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="stat-value">{stats.pendientes}</p>
            <p className="stat-label">
              {user?.rol === 'superadmin' ? 'Pagos Pendientes' : 'Pendientes'}
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="stat-value">{stats.en_proceso}</p>
            <p className="stat-label">En Proceso</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="stat-value">{stats.completados}</p>
            <p className="stat-label">Completados</p>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {user?.rol === 'cliente' ? 'Mis Pedidos Recientes' : 'Pedidos Recientes'}
          </h2>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay pedidos para mostrar</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {recentOrders.map((pedido) => (
              <div key={pedido.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{pedido.titulo}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {pedido.servicio?.nombre} • {pedido.zona?.nombre}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {(() => {
                          const [year, month, day] = pedido.fecha_entrega.split('-').map(Number);
                          const fecha = new Date(year, month - 1, day);
                          return fecha.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' }) + ' - ' + TURNOS_ENTREGA_LABELS[pedido.turno_entrega];
                        })()}
                      </span>
                    </div>
                    {user?.rol !== 'cliente' && pedido.cliente && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Cliente: {pedido.cliente.nombre_completo}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={pedido.estado} />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pedido.monto_usd.toFixed(2)} USD
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
