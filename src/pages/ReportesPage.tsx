import { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  Download,
  FileText,
  DollarSign,
  Users,
  Filter,
  Calendar,
  TrendingUp,
  Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useBCVRate } from '../hooks/useBCVRate';
import { LoadingCard } from '../components/common/Loading';
import {
  ESTADOS_PEDIDO_LABELS,
  ESTADOS_PEDIDO_COLORS,
  METODOS_PAGO_LABELS,
  type Pedido,
  type Zona,
  type Servicio,
  type Perfil,
  type EstadoPedido,
  type FiltrosReporte,
} from '../types';

export function ReportesPage() {
  const { user } = useAuth();
  const { rate: tasaBcvApi } = useBCVRate();
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [empleados, setEmpleados] = useState<Perfil[]>([]);
  const [config, setConfig] = useState<any>(null);

  const [filtros, setFiltros] = useState<FiltrosReporte>({
    fecha_inicio: null,
    fecha_fin: null,
    zona_id: null,
    servicio_id: null,
    empleado_id: null,
    estado: null,
  });

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (!loading) fetchReportData();
  }, [filtros]);

  const fetchInitialData = async () => {
    const [zonasRes, serviciosRes, empleadosRes, configRes] = await Promise.all([
      supabase.from('zonas').select('*').order('nombre'),
      supabase.from('servicios').select('*').order('nombre'),
      supabase.from('perfiles').select('*').eq('rol', 'empleado').order('nombre_completo'),
      supabase.from('configuracion').select('*').maybeSingle(),
    ]);

    if (zonasRes.data) setZonas(zonasRes.data as Zona[]);
    if (serviciosRes.data) setServicios(serviciosRes.data as Servicio[]);
    if (empleadosRes.data) setEmpleados(empleadosRes.data as Perfil[]);
    if (configRes.data) setConfig(configRes.data);

    fetchReportData();
  };

  const fetchReportData = async () => {
    let query = supabase
      .from('pedidos')
      .select('*, cliente:perfiles!pedidos_cliente_id_fkey(*), empleado:perfiles!pedidos_empleado_id_fkey(*), servicio:servicios(*), zona:zonas(*)')
      .order('created_at', { ascending: false });

    // Apply role-based filter
    if (user?.rol === 'empleado' && user.zona_id) {
      query = query.eq('zona_id', user.zona_id);
    }

    // Apply filters
    if (filtros.fecha_inicio) {
      query = query.gte('created_at', filtros.fecha_inicio);
    }
    if (filtros.fecha_fin) {
      query = query.lte('created_at', filtros.fecha_fin + 'T23:59:59');
    }
    if (filtros.zona_id) {
      query = query.eq('zona_id', filtros.zona_id);
    }
    if (filtros.servicio_id) {
      query = query.eq('servicio_id', filtros.servicio_id);
    }
    if (filtros.empleado_id) {
      query = query.eq('empleado_id', filtros.empleado_id);
    }
    if (filtros.estado) {
      query = query.eq('estado', filtros.estado);
    }

    const { data, error } = await query;

    if (!error && data) {
      setPedidos(data as Pedido[]);
    }
    setLoading(false);
  };

  // Calculated metrics
  const tasaActual = tasaBcvApi || config?.tasa_bcv || 36.5;
  const pedidosPagados = pedidos.filter(p => p.pago_verificado);
  const metrics = {
    totalIngresosUSD: pedidosPagados.reduce((acc, p) => acc + p.monto_usd, 0),
    totalIngresosBS: pedidosPagados.reduce((acc, p) => acc + (p.monto_usd * tasaActual), 0),
    totalValorUSD: pedidos.reduce((acc, p) => acc + p.monto_usd, 0),
    totalValorBS: pedidos.reduce((acc, p) => acc + (p.monto_usd * tasaActual), 0),
    totalPedidos: pedidos.length,
    pedidosPorEstado: Object.fromEntries(
      (Object.keys(ESTADOS_PEDIDO_LABELS) as EstadoPedido[]).map(estado => [
        estado,
        pedidos.filter(p => p.estado === estado).length,
      ])
    ),
    serviciosMasSolicitados: servicios
      .map(s => ({
        servicio: s,
        cantidad: pedidos.filter(p => p.servicio_id === s.id).length,
        ingresos: pedidos.filter(p => p.servicio_id === s.id && p.pago_verificado).reduce((acc, p) => acc + p.monto_usd, 0),
      }))
      .filter(s => s.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad),
    pedidosPorFecha: Object.entries(
      pedidos.reduce((acc, p) => {
        const fecha = new Date(p.created_at).toLocaleDateString('es-VE');
        acc[fecha] = (acc[fecha] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).slice(-14),
  };

  const exportCSV = () => {
    const headers = [
      'ID',
      'Titulo',
      'Cliente',
      'Servicio',
      'Zona',
      'Estado',
      'Monto USD',
      'Monto BS',
      'Metodo Pago',
      'Fecha Creacion',
      'Fecha Entrega',
    ];

    const rows = pedidos.map(p => [
      p.id.slice(0, 8),
      p.titulo,
      p.cliente?.nombre_completo || '',
      p.servicio?.nombre || '',
      p.zona?.nombre || '',
      ESTADOS_PEDIDO_LABELS[p.estado],
      p.monto_usd.toFixed(2),
      p.monto_bs?.toFixed(2) || '',
      p.metodo_pago ? METODOS_PAGO_LABELS[p.metodo_pago] : '',
      new Date(p.created_at).toLocaleDateString('es-VE'),
      new Date(p.fecha_entrega).toLocaleDateString('es-VE'),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_PrintaVe_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportPDF = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte PrintaVe</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; }
            h1 { color: #1e40af; margin-bottom: 20px; }
            .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
            .stat { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
            .stat-value { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
            .stat-label { color: #6b7280; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f3f4f6; font-weight: 600; }
            .servicio-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Reporte PrintaVe</h1>
          <p>Generado: ${new Date().toLocaleDateString('es-VE', { dateStyle: 'full' })}</p>
          <p>
            ${filtros.fecha_inicio ? `Desde: ${filtros.fecha_inicio}` : ''}
            ${filtros.fecha_fin ? ` - Hasta: ${filtros.fecha_fin}` : ''}
          </p>

          <div class="stat-grid">
            <div class="stat">
              <div class="stat-value">$${metrics.totalIngresosUSD.toFixed(2)}</div>
              <div class="stat-label">Total Ingresos USD</div>
            </div>
            <div class="stat">
              <div class="stat-value">Bs. ${metrics.totalIngresosBS.toLocaleString('es-VE')}</div>
              <div class="stat-label">Total Ingresos Bolívares</div>
            </div>
            <div class="stat">
              <div class="stat-value">${metrics.totalPedidos}</div>
              <div class="stat-label">Total Pedidos</div>
            </div>
            <div class="stat">
              <div class="stat-value">${(pedidos.filter(p => p.estado === 'entregado').length / Math.max(metrics.totalPedidos, 1) * 100).toFixed(0)}%</div>
              <div class="stat-label">Tasa de Entrega</div>
            </div>
          </div>

          <h2 style="margin-top: 24px;">Servicios más Solicitados</h2>
          ${metrics.serviciosMasSolicitados.map(s => `
            <div class="servicio-row">
              <span>${s.servicio.nombre}</span>
              <span>${s.cantidad} pedidos - $${s.ingresos.toFixed(2)}</span>
            </div>
          `).join('')}

          <h2 style="margin-top: 24px;">Pedidos por Estado</h2>
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(metrics.pedidosPorEstado).map(([estado, cantidad]) => `
                <tr>
                  <td>${ESTADOS_PEDIDO_LABELS[estado as EstadoPedido]}</td>
                  <td>${cantidad}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2 style="margin-top: 24px;">Detalle de Pedidos</h2>
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Estado</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${pedidos.slice(0, 50).map(p => `
                <tr>
                  <td>${p.titulo}</td>
                  <td>${p.cliente?.nombre_completo || '-'}</td>
                  <td>${p.servicio?.nombre}</td>
                  <td>${ESTADOS_PEDIDO_LABELS[p.estado]}</td>
                  <td>$${p.monto_usd.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="color: #6b7280; margin-top: 16px;">
            Mostrando ${Math.min(pedidos.length, 50)} de ${pedidos.length} pedidos
          </p>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Reportes y Estadisticas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user?.rol === 'superadmin' ? 'Vista general del negocio' : 'Estadisticas de tu zona'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary">
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button onClick={exportPDF} className="btn-primary">
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card card-padding">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900 dark:text-white">Filtros</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label text-xs">Fecha inicio</label>
            <input
              type="date"
              value={filtros.fecha_inicio || ''}
              onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value || null })}
              className="input"
            />
          </div>
          <div>
            <label className="label text-xs">Fecha fin</label>
            <input
              type="date"
              value={filtros.fecha_fin || ''}
              onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value || null })}
              className="input"
            />
          </div>
          {user?.rol === 'superadmin' && (
            <div>
              <label className="label text-xs">Zona</label>
              <select
                value={filtros.zona_id || ''}
                onChange={(e) => setFiltros({ ...filtros, zona_id: e.target.value || null })}
                className="input"
              >
                <option value="">Todas las zonas</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label text-xs">Estado</label>
            <select
              value={filtros.estado || ''}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as EstadoPedido | null || null })}
              className="input"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS_PEDIDO_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="stat-value">${metrics.totalIngresosUSD.toFixed(2)}</p>
          <p className="stat-label">Ingresos USD</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <p className="stat-value text-base font-semibold">Bs. {metrics.totalIngresosBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</p>
          <p className="stat-label">Ingresos (Pagados)</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="stat-value text-base font-semibold">Bs. {metrics.totalValorBS.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</p>
          <p className="stat-label">Valor Total Pedidos</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="stat-value">{metrics.totalPedidos}</p>
          <p className="stat-label">Total Pedidos</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-success-100 dark:bg-green-900/30 rounded-xl">
              <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="stat-value">
            {(pedidos.filter(p => p.estado === 'entregado').length / Math.max(metrics.totalPedidos, 1) * 100).toFixed(0)}%
          </p>
          <p className="stat-label">Tasa de Entrega</p>
        </div>
      </div>

      {/* Graficos y tablas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Servicios mas solicitados */}
        <div className="card card-padding">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Servicios mas Solicitados
          </h3>
          <div className="space-y-3">
            {metrics.serviciosMasSolicitados.map((item) => (
              <div key={item.servicio.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{item.servicio.nombre}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.cantidad} pedidos</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600 dark:text-primary-400">${item.ingresos.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {metrics.serviciosMasSolicitados.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">No hay datos</p>
            )}
          </div>
        </div>

        {/* Pedidos por estado */}
        <div className="card card-padding">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Pedidos por Estado
          </h3>
          <div className="space-y-2">
            {Object.entries(metrics.pedidosPorEstado).map(([estado, cantidad]) => (
              <div key={estado} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {ESTADOS_PEDIDO_LABELS[estado as EstadoPedido]}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{cantidad}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        estado === 'entregado' ? 'bg-green-500' :
                        estado === 'en_proceso' ? 'bg-purple-500' :
                        estado === 'por_revisar' ? 'bg-yellow-500' :
                        estado === 'rechazado' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${Math.min((cantidad / Math.max(metrics.totalPedidos, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de pedidos recientes */}
      <div className="card overflow-hidden" ref={printRef}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Pedidos Detallados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="table-header">Titulo</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Servicio</th>
                <th className="table-header">Estado</th>
                <th className="table-header text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {pedidos.slice(0, 20).map((pedido) => (
                <tr key={pedido.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="table-cell font-medium">{pedido.titulo}</td>
                  <td className="table-cell">{pedido.cliente?.nombre_completo || '-'}</td>
                  <td className="table-cell">{pedido.servicio?.nombre}</td>
                  <td className="table-cell">
                    <span className={`badge ${ESTADOS_PEDIDO_COLORS[pedido.estado]}`}>
                      {ESTADOS_PEDIDO_LABELS[pedido.estado]}
                    </span>
                  </td>
                  <td className="table-cell text-right font-medium">${pedido.monto_usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pedidos.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No hay pedidos con los filtros seleccionados
          </div>
        )}
        {pedidos.length > 20 && (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
            Mostrando 20 de {pedidos.length} pedidos. Exporta a CSV/PDF para ver todos.
          </div>
        )}
      </div>
    </div>
  );
}
