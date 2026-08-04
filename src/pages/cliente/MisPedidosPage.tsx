import { useState, useEffect } from 'react';
import { FileText, Eye, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBCVRate } from '../../hooks/useBCVRate';
import { LoadingCard } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import {
  ESTADOS_PEDIDO_LABELS,
  METODOS_PAGO_LABELS,
  TURNOS_ENTREGA_LABELS,
  type Pedido,
  type Configuracion,
  type EstadoPedido,
} from '../../types';

export function MisPedidosPage() {
  const { user } = useAuth();
  const { rate: tasaBcvApi } = useBCVRate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pagoFormData, setPagoFormData] = useState({ metodo_pago: '', referencia: '' });
  const [motivoCambios, setMotivoCambios] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [archivos, setArchivos] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchPedidos();
      fetchConfig();
    }
  }, [user]);

  // Cargar archivos cuando se selecciona un pedido
  useEffect(() => {
    if (selectedPedido) {
      fetchArchivos(selectedPedido.id);
    }
  }, [selectedPedido]);

  const fetchArchivos = async (pedidoId: string) => {
    const { data } = await supabase
      .from('archivos_pedidos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .eq('tipo_archivo', 'archivo_procesado');
    setArchivos((data as any[]) || []);
  };

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`pedidos-cliente:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `cliente_id=eq.${user.id}`,
        },
        () => {
          fetchPedidos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchPedidos = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, servicio:servicios(*), zona:zonas(*)')
      .eq('cliente_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPedidos(data as Pedido[]);
    }
    setLoading(false);
  };

  const fetchConfig = async () => {
    const { data } = await supabase.from('configuracion').select('*').maybeSingle();
    if (data) setConfig(data as Configuracion);
  };

  const handleEnviarPago = async () => {
    if (!selectedPedido || !pagoFormData.metodo_pago || !pagoFormData.referencia) return;

    setProcesando(true);

    const { error } = await supabase
      .from('pedidos')
      .update({
        estado: 'pago_por_verificar',
        metodo_pago: pagoFormData.metodo_pago,
        referencia_pago: pagoFormData.referencia,
        fecha_pago: new Date().toISOString(),
        monto_bs: config ? selectedPedido.monto_usd * config.tasa_bcv : null,
      })
      .eq('id', selectedPedido.id);

    if (!error) {
      // Notificar al superadmin
      const { data: superadmins } = await supabase
        .from('perfiles')
        .select('id')
        .eq('rol', 'superadmin');

      if (superadmins && superadmins.length > 0) {
        await Promise.all(
          superadmins.map((admin) =>
            supabase.from('notificaciones').insert({
              usuario_id: admin.id,
              tipo: 'nuevo_pago',
              titulo: 'Nuevo Pago por Verificar',
              mensaje: `El cliente ${user?.nombre_completo} ha enviado una referencia de pago para "${selectedPedido.titulo}".`,
              data: { pedido_id: selectedPedido.id },
            })
          )
        );
      }

      setSelectedPedido(null);
      setPagoFormData({ metodo_pago: '', referencia: '' });
      fetchPedidos();
    }

    setProcesando(false);
  };

  const handleAprobarRevision = async () => {
    if (!selectedPedido) return;

    setProcesando(true);

    const { error } = await supabase
      .from('pedidos')
      .update({
        estado: 'listo_para_entregar',
      })
      .eq('id', selectedPedido.id);

    if (!error) {
      // Notificar al empleado
      if (selectedPedido.empleado_id) {
        await supabase.from('notificaciones').insert({
          usuario_id: selectedPedido.empleado_id,
          tipo: 'revision_aprobada',
          titulo: 'Tarea Aprobada',
          mensaje: `El cliente ${user?.nombre_completo} aprobó la tarea "${selectedPedido.titulo}". Está lista para entregar.`,
          data: { pedido_id: selectedPedido.id },
        });
      }

      setSelectedPedido(null);
      fetchPedidos();
    }

    setProcesando(false);
  };

  const handleSolicitarCambios = async (esRevisionAdicional: boolean = false) => {
    if (!selectedPedido || !motivoCambios.trim()) return;

    setProcesando(true);

    if (!esRevisionAdicional) {
      // Revisión dentro del límite permitido
      const revisionsLeft = (selectedPedido.servicio?.limite_revisiones || 2) - (selectedPedido.numero_revisiones || 0);
      if (revisionsLeft <= 0) {
        setProcesando(false);
        return;
      }
    }

    const { error } = await supabase
      .from('pedidos')
      .update({
        estado: esRevisionAdicional ? 'en_revision_cliente' : 'cambios_solicitados',
        motivo_cambios: motivoCambios,
        numero_revisiones: esRevisionAdicional ? (selectedPedido.numero_revisiones || 0) : (selectedPedido.numero_revisiones || 0) + 1,
      })
      .eq('id', selectedPedido.id);

    if (!error) {
      // Notificar al empleado
      if (selectedPedido.empleado_id) {
        await supabase.from('notificaciones').insert({
          usuario_id: selectedPedido.empleado_id,
          tipo: esRevisionAdicional ? 'revision_adicional_solicitada' : 'cambios_solicitados',
          titulo: esRevisionAdicional ? 'Se Solicitó Revisión Adicional' : 'Se Solicitaron Cambios',
          mensaje: esRevisionAdicional
            ? `El cliente ${user?.nombre_completo} solicitó una revisión adicional en la tarea "${selectedPedido.titulo}": "${motivoCambios}"`
            : `El cliente ${user?.nombre_completo} solicitó cambios en la tarea "${selectedPedido.titulo}": "${motivoCambios}"`,
          data: { pedido_id: selectedPedido.id },
        });
      }

      setSelectedPedido(null);
      setMotivoCambios('');
      fetchPedidos();
    }

    setProcesando(false);
  };

  const formatBs = (usd: number) => {
    const tasaActual = tasaBcvApi || config?.tasa_bcv || 36.5;
    return (usd * tasaActual).toLocaleString('es-VE', { minimumFractionDigits: 2 });
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Mis Pedidos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Historial de tus tareas solicitadas
        </p>
      </div>

      {/* Pedidos */}
      {pedidos.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-gray-400" />}
          title="No tienes pedidos"
          description="Crea tu primera tarea para comenzar"
        />
      ) : (
        <div className="space-y-4">
          {pedidos.map((pedido) => (
            <div
              key={pedido.id}
              className="card card-padding cursor-pointer hover:shadow-soft-lg transition-all"
              onClick={() => setSelectedPedido(pedido)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={pedido.estado} />
                    {pedido.pago_verificado && (
                      <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Pagado
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {pedido.titulo}
                  </h3>
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
                </div>

                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">
                      ${pedido.monto_usd.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Bs. {pedido.monto_bs ? pedido.monto_bs.toLocaleString('es-VE') : formatBs(pedido.monto_usd)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(pedido.created_at).toLocaleDateString('es-VE')}
                  </p>
                </div>
              </div>

              {/* Action required */}
              {pedido.estado === 'aprobado_para_pago' && (
                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    <span>Acción requerida: Procede con el pago</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedPedido && (
        <Modal
          isOpen={!!selectedPedido}
          onClose={() => { setSelectedPedido(null); setPagoFormData({ metodo_pago: '', referencia: '' }); }}
          title="Detalle del Pedido"
          size="xl"
        >
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedPedido.estado} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(selectedPedido.created_at).toLocaleDateString('es-VE')}
              </span>
            </div>

            {/* Info */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Titulo</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedPedido.titulo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Servicio</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedPedido.servicio?.nombre}
                  {selectedPedido.detalle_impresion && ' + Impresión'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Entrega</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {(() => {
                    const [year, month, day] = selectedPedido.fecha_entrega.split('-').map(Number);
                    const fecha = new Date(year, month - 1, day);
                    return TURNOS_ENTREGA_LABELS[selectedPedido.turno_entrega] + ' - ' + fecha.toLocaleDateString('es-VE');
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Zona</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedPedido.zona?.nombre}</p>
              </div>
            </div>

            {/* Description */}
            {selectedPedido.descripcion && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripcion</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                  {selectedPedido.descripcion}
                </p>
              </div>
            )}

            {/* Revisiones Info */}
            {selectedPedido.servicio && ['investigacion_basica', 'tarea_compleja', 'exposicion'].includes(selectedPedido.servicio.tipo) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                  ✏️ Correcciones Permitidas
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Este servicio incluye <strong>máximo 2 correcciones/revisiones</strong> después de que el empleado complete la tarea. Úsalas sabiamente para solicitar los cambios que necesites.
                </p>
              </div>
            )}

            {/* Impresión Info */}
            {selectedPedido.detalle_impresion && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                  📋 Detalles de Impresión
                </p>
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <p>• Páginas: <strong>{selectedPedido.detalle_impresion.paginas}</strong></p>
                  <p>• Copias: <strong>{selectedPedido.detalle_impresion.copias}</strong></p>
                  <p>• Color: <strong>{selectedPedido.detalle_impresion.color ? 'Sí (Color)' : 'No (B/N)'}</strong></p>
                  <p>• Tamaño: <strong>{selectedPedido.detalle_impresion.tamano_hoja.toUpperCase()}</strong></p>
                  <p>• Tipo de papel: <strong>{selectedPedido.detalle_impresion.tipo_papel}</strong></p>
                  <p>• Intercalado: <strong>{selectedPedido.detalle_impresion.intercalado ? 'Sí' : 'No'}</strong></p>
                </div>
              </div>
            )}

            {/* Monto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monto USD</p>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  ${selectedPedido.monto_usd.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monto en Bolivares</p>
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

            {/* Rechazo */}
            {selectedPedido.motivo_rechazo && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Motivo del rechazo: {selectedPedido.motivo_rechazo}
                </p>
              </div>
            )}

            {/* Cambios solicitados */}
            {selectedPedido.motivo_cambios && (
              <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-xl">
                <p className="text-sm font-medium text-pink-700 dark:text-pink-300 mb-1">
                  Motivo de cambios solicitados:
                </p>
                <p className="text-sm text-pink-600 dark:text-pink-400">
                  {selectedPedido.motivo_cambios}
                </p>
              </div>
            )}

            {/* Review Section */}
            {selectedPedido.estado === 'en_revision_cliente' && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Revisar Tarea</h3>

                {/* Archivos para descargar */}
                {archivos.length > 0 && (
                  <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                      📁 Archivos de la tarea:
                    </p>
                    <div className="space-y-2">
                      {archivos.map((archivo) => (
                        <a
                          key={archivo.id}
                          href={archivo.url_archivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors min-w-0"
                          title={archivo.nombre_archivo}
                        >
                          <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium flex-1 truncate">
                            {archivo.nombre_archivo}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0">Descargar</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    La tarea está lista para tu revisión. ¿Te parece que está bien hecha?
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Revisiones disponibles: {(selectedPedido.servicio?.limite_revisiones || 2) - (selectedPedido.numero_revisiones || 0)} de {selectedPedido.servicio?.limite_revisiones || 2}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(((selectedPedido.numero_revisiones || 0) / (selectedPedido.servicio?.limite_revisiones || 2)) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Aprobar */}
                <button
                  onClick={handleAprobarRevision}
                  disabled={procesando}
                  className="btn-success w-full"
                >
                  {procesando ? 'Procesando...' : '✓ Aprobado, está bien hecho'}
                </button>

                {/* Solicitar cambios */}
                {((selectedPedido.numero_revisiones || 0) < (selectedPedido.servicio?.limite_revisiones || 2)) && (
                  <>
                    <div>
                      <label className="label">¿Qué cambios necesitas?</label>
                      <textarea
                        value={motivoCambios}
                        onChange={(e) => setMotivoCambios(e.target.value)}
                        className="input min-h-20"
                        placeholder="Describe los cambios que necesitas que se hagan..."
                      />
                    </div>

                    <button
                      onClick={handleSolicitarCambios}
                      disabled={procesando || !motivoCambios.trim()}
                      className="btn-secondary w-full"
                    >
                      {procesando ? 'Enviando...' : 'Solicitar Cambios'}
                    </button>
                  </>
                )}

                {((selectedPedido.numero_revisiones || 0) >= (selectedPedido.servicio?.limite_revisiones || 2)) && (
                  <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                        ⚠️ Límite de revisiones alcanzado
                      </p>
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        Has utilizado todas tus revisiones permitidas. Si aún necesitas cambios, solicita una revisión adicional.
                      </p>
                    </div>
                    <div>
                      <label className="label text-sm">¿Por qué necesitas otra revisión?</label>
                      <textarea
                        value={motivoCambios}
                        onChange={(e) => setMotivoCambios(e.target.value)}
                        placeholder="Explica brevemente qué cambios adicionales necesitas..."
                        className="input min-h-16 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (!motivoCambios.trim()) {
                          setError('Explica por qué necesitas otra revisión');
                          return;
                        }
                        handleSolicitarCambios(true);
                      }}
                      disabled={procesando || !motivoCambios.trim()}
                      className="btn-secondary w-full"
                    >
                      Solicitar Revisión Adicional
                    </button>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      El empleado revisará tu solicitud y decidirá si es posible.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Payment Section */}
            {selectedPedido.estado === 'aprobado_para_pago' && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Proceder con el Pago</h3>

                {/* Metodo de pago selector */}
                <div>
                  <label className="label">Metodo de Pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['pago_movil', 'transferencia', 'zinli', 'binance'] as const).map((metodo) => (
                      <button
                        key={metodo}
                        type="button"
                        onClick={() => setPagoFormData({ ...pagoFormData, metodo_pago: metodo })}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          pagoFormData.metodo_pago === metodo
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {METODOS_PAGO_LABELS[metodo]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Details */}
                {pagoFormData.metodo_pago && config && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-2">
                    {pagoFormData.metodo_pago === 'pago_movil' && (
                      <>
                        <p className="text-sm"><span className="font-medium">Banco:</span> {config.pago_movil_banco}</p>
                        <p className="text-sm"><span className="font-medium">Telefono:</span> {config.pago_movil_telefono}</p>
                        <p className="text-sm"><span className="font-medium">Cedula:</span> {config.pago_movil_cedula}</p>
                      </>
                    )}
                    {pagoFormData.metodo_pago === 'transferencia' && (
                      <>
                        <p className="text-sm"><span className="font-medium">Banco:</span> {config.transferencia_banco}</p>
                        <p className="text-sm"><span className="font-medium">Cuenta:</span> {config.transferencia_cuenta}</p>
                        <p className="text-sm"><span className="font-medium">Cedula:</span> {config.transferencia_cedula}</p>
                        <p className="text-sm"><span className="font-medium">Titular:</span> {config.transferencia_nombre}</p>
                      </>
                    )}
                    {pagoFormData.metodo_pago === 'zinli' && (
                      <p className="text-sm"><span className="font-medium">Email Zinli:</span> {config.zinli_email}</p>
                    )}
                    {pagoFormData.metodo_pago === 'binance' && (
                      <p className="text-sm"><span className="font-medium">Binance ID:</span> {config.binance_id}</p>
                    )}
                  </div>
                )}

                {/* Referencia */}
                <div>
                  <label className="label">Numero de Referencia / ID de Transaccion</label>
                  <input
                    type="text"
                    value={pagoFormData.referencia}
                    onChange={(e) => setPagoFormData({ ...pagoFormData, referencia: e.target.value })}
                    className="input"
                    placeholder="Ingresa la referencia del pago"
                  />
                </div>

                <button
                  onClick={handleEnviarPago}
                  disabled={procesando || !pagoFormData.metodo_pago || !pagoFormData.referencia}
                  className="btn-primary w-full"
                >
                  {procesando ? 'Enviando...' : 'Confirmar Pago'}
                </button>
              </div>
            )}

            {/* Estado completado */}
            {selectedPedido.estado === 'entregado' && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="font-medium text-green-700 dark:text-green-300">
                  ¡Pedido entregado!
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
