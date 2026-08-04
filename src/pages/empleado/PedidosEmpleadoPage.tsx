import { useState, useEffect } from 'react';
import { Check, X, Eye, MessageCircle, Clock, Filter, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { emailService } from '../../lib/emailService';
import { useAuth } from '../../contexts/AuthContext';
import { useBCVRate } from '../../hooks/useBCVRate';
import { LoadingCard } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  ESTADOS_PEDIDO_LABELS,
  TURNOS_ENTREGA_LABELS,
  METODOS_PAGO_LABELS,
  type Pedido,
  type EstadoPedido,
  type Configuracion,
  type ArchivoPedido,
} from '../../types';

export function PedidosEmpleadoPage() {
  const { user } = useAuth();
  const { rate: tasaBcvApi } = useBCVRate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | 'todos'>('todos');
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);
  const [archivos, setArchivos] = useState<ArchivoPedido[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  // Solicitar permiso para notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (user?.zona_id) {
      fetchPedidos();
      fetchConfig();
    }
  }, [user, filtroEstado]);

  useEffect(() => {
    if (selectedPedido) {
      getArchivosProcessados(selectedPedido.id).then(setArchivos);
    }
  }, [selectedPedido]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.zona_id) return;

    const channel = supabase
      .channel(`pedidos-zona:${user.zona_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
          filter: `zona_id=eq.${user.zona_id}`,
        },
        (payload) => {
          // Mostrar notificación de navegador
          if (Notification.permission === 'granted') {
            new Notification('🔔 Nuevo Pedido', {
              body: `Tienes un nuevo pedido para revisar`,
              icon: '/notification-icon.png',
            });
          }
          fetchPedidos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, filtroEstado]);

  const fetchPedidos = async () => {
    if (!user?.zona_id) return;

    let query = supabase
      .from('pedidos')
      .select('*, cliente:perfiles!pedidos_cliente_id_fkey(id, nombre_completo, telefono, rol, zona_id), servicio:servicios(*), zona:zonas(*)')
      .eq('zona_id', user.zona_id)
      .order('created_at', { ascending: true });

    if (filtroEstado !== 'todos') {
      query = query.eq('estado', filtroEstado);
    }

    const { data, error } = await query;

    if (!error && data) {
      console.log('Pedidos cargados:', data);
      if (data.length > 0) {
        console.log('Cliente del primer pedido:', data[0].cliente);
      }
      setPedidos(data as Pedido[]);
    }
    setLoading(false);
  };

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('configuracion')
      .select('*')
      .maybeSingle();
    if (data) setConfig(data as Configuracion);
  };

  const generarLinkWhatsApp = (pedido: Pedido, config: Configuracion) => {
    const telefonoCliente = pedido.cliente?.telefono?.replace(/\D/g, '');
    if (!telefonoCliente) return null;

    const tasaActual = tasaBcvApi || config.tasa_bcv || 36.5;

    let mensajePago = `Hola ${pedido.cliente?.nombre_completo?.split(' ')[0]}, tu pedido "${pedido.titulo}" fue aprobado.\n\n`;
    mensajePago += `📋 Detalles del Pago:\n`;
    mensajePago += `Monto: $${pedido.monto_usd.toFixed(2)} USD\n`;
    mensajePago += `Equivalente: Bs. ${(pedido.monto_usd * tasaActual).toLocaleString('es-VE', { maximumFractionDigits: 2 })}\n`;

    if (pedido.detalle_impresion) {
      mensajePago += `\n📄 Impresión:\n`;
      mensajePago += `• Páginas: ${pedido.detalle_impresion.paginas}\n`;
      mensajePago += `• Copias: ${pedido.detalle_impresion.copias}\n`;
      mensajePago += `• Color: ${pedido.detalle_impresion.color ? 'Sí (Color)' : 'No (B/N)'}\n`;
      mensajePago += `• Tamaño: ${pedido.detalle_impresion.tamano_hoja.toUpperCase()}\n`;
      mensajePago += `• Tipo de papel: ${pedido.detalle_impresion.tipo_papel}\n`;
    }

    mensajePago += `\n💳 Datos de Pago:\n`;
    mensajePago += `\n🔵 Pago Móvil:\n`;
    mensajePago += `Banco: ${config.pago_movil_banco}\n`;
    mensajePago += `Teléfono: ${config.pago_movil_telefono}\n`;
    mensajePago += `Cédula: ${config.pago_movil_cedula}\n`;

    mensajePago += `\n🏦 Transferencia Bancaria:\n`;
    mensajePago += `Banco: ${config.transferencia_banco}\n`;
    mensajePago += `Cuenta: ${config.transferencia_cuenta}\n`;
    mensajePago += `Nombre: ${config.transferencia_nombre}\n`;
    mensajePago += `Cédula: ${config.transferencia_cedula}\n`;

    mensajePago += `\n💎 Zinli: ${config.zinli_email}\n`;
    mensajePago += `🪙 Binance ID: ${config.binance_id}\n\n`;

    mensajePago += `Cuando hayas hecho el pago, comparte el comprobante para verificar.`;

    const telefonoFormato = telefonoCliente.startsWith('58') ? telefonoCliente : `58${telefonoCliente}`;
    const mensajeEncodificado = encodeURIComponent(mensajePago);

    return `https://wa.me/${telefonoFormato}?text=${mensajeEncodificado}`;
  };

  const handleEstadoChange = async (nuevoEstado: EstadoPedido, motivo?: string) => {
    if (!selectedPedido || !user) return;

    setProcesando(true);

    // Detectar si es la primera asignación del empleado
    const esPromeraAsignacion = !selectedPedido.empleado_id;

    const updateData: Record<string, unknown> = {
      estado: nuevoEstado,
      empleado_id: user.id,
    };

    if (nuevoEstado === 'rechazado') {
      updateData.motivo_rechazo = motivo;
      updateData.fecha_revision = new Date().toISOString();
    } else if (nuevoEstado === 'aprobado_para_pago') {
      updateData.fecha_revision = new Date().toISOString();
    } else if (nuevoEstado === 'en_proceso') {
      updateData.fecha_inicio_proceso = new Date().toISOString();
    } else if (nuevoEstado === 'en_revision_cliente') {
      updateData.fecha_en_revision = new Date().toISOString();
    } else if (nuevoEstado === 'cambios_solicitados') {
      // No cambiar estado aquí, el cliente lo cambia
    } else if (nuevoEstado === 'listo_para_entregar') {
      updateData.fecha_listo = new Date().toISOString();
    } else if (nuevoEstado === 'entregado') {
      updateData.fecha_entrega_real = new Date().toISOString();
    }

    const { error } = await supabase
      .from('pedidos')
      .update(updateData)
      .eq('id', selectedPedido.id);

    // Enviar correo de asignación si es la primera vez que se asigna
    if (!error && esPromeraAsignacion) {
      await emailService.sendTaskAssignmentEmail(selectedPedido.id);
    }

    if (!error) {
      // Crear notificación al cliente
      let tipo = '';
      let titulo = '';
      let mensaje = '';

      switch (nuevoEstado) {
        case 'rechazado':
          tipo = 'pedido_rechazado';
          titulo = 'Pedido Rechazado';
          mensaje = `Tu pedido "${selectedPedido.titulo}" fue rechazado. Motivo: ${motivo}`;
          break;
        case 'aprobado_para_pago':
          tipo = 'pedido_aprobado';
          titulo = 'Pedido Aprobado';
          mensaje = `Tu pedido "${selectedPedido.titulo}" fue aprobado. Ya puedes proceder con el pago.`;
          break;
        case 'en_revision_cliente':
          tipo = 'tarea_en_revision';
          titulo = 'Tarea en Revisión';
          mensaje = `Tu tarea "${selectedPedido.titulo}" está lista. Por favor revísala y confirma si está bien hecha.`;
          break;
        case 'listo_para_entregar':
          tipo = 'pedido_listo';
          titulo = 'Pedido Listo para Entregar';
          mensaje = `Tu pedido "${selectedPedido.titulo}" fue aprobado y está listo para retirar en ${TURNOS_ENTREGA_LABELS[selectedPedido.turno_entrega]}.`;
          break;
        case 'entregado':
          tipo = 'pedido_entregado';
          titulo = 'Pedido Entregado';
          mensaje = `Tu pedido "${selectedPedido.titulo}" ha sido marcado como entregado. ¡Gracias por tu preferencia!`;
          break;
      }

      if (tipo) {
        await supabase.from('notificaciones').insert({
          usuario_id: selectedPedido.cliente_id,
          tipo,
          titulo,
          mensaje,
          data: { pedido_id: selectedPedido.id },
        });

        // Notificación de navegador extra para "en_revision_cliente"
        if (nuevoEstado === 'en_revision_cliente' && 'Notification' in window && Notification.permission === 'granted') {
          // Esto se ejecutará en el empleado, pero idealmente querríamos en el cliente
          // Por ahora, es informativo para el empleado que envió a revisión
          console.log(`✅ Notificación enviada al cliente: ${titulo} - ${mensaje}`);
        }
      }

      setSelectedPedido(null);
      setMotivoRechazo('');
      fetchPedidos();
    }

    setProcesando(false);
  };

  const getWhatsAppLink = (pedido: Pedido) => {
    if (!pedido.cliente?.telefono || !config) return '#';

    const mensaje = encodeURIComponent(
      `¡Hola! Tu tarea "${pedido.titulo}" está lista.\n\n` +
      `Puedes retirarla en ${TURNOS_ENTREGA_LABELS[pedido.turno_entrega]} en ${pedido.zona?.sitio_entrega || 'el sitio acordado'}.\n\n` +
      `¡Gracias por confiar en PrintaVe!`
    );

    return `https://wa.me/58${pedido.cliente.telefono.replace(/\D/g, '')}?text=${mensaje}`;
  };

  const generarLinkWhatsAppRevision = (pedido: Pedido) => {
    const telefonoCliente = pedido.cliente?.telefono?.replace(/\D/g, '');
    if (!telefonoCliente) return null;

    let mensajeRevision = `¡Hola ${pedido.cliente?.nombre_completo?.split(' ')[0]}! 👋\n\n`;
    mensajeRevision += `Tu tarea "${pedido.titulo}" está lista para revisar.\n\n`;
    mensajeRevision += `📱 Por favor accede a la aplicación PrintaVe para revisar el trabajo realizado.\n`;
    mensajeRevision += `✅ Puedes aprobar si está bien hecho, o solicitar cambios (máximo 2 correcciones).\n\n`;
    mensajeRevision += `¡Gracias por usar PrintaVe!`;

    const telefonoFormato = telefonoCliente.startsWith('58') ? telefonoCliente : `58${telefonoCliente}`;
    const mensajeEncodificado = encodeURIComponent(mensajeRevision);

    return `https://wa.me/${telefonoFormato}?text=${mensajeEncodificado}`;
  };

  const generarLinkWhatsAppListo = (pedido: Pedido) => {
    const telefonoCliente = pedido.cliente?.telefono?.replace(/\D/g, '');
    if (!telefonoCliente) return null;

    let mensajeListoParams = `¡Hola ${pedido.cliente?.nombre_completo?.split(' ')[0]}! ✅\n\n`;
    mensajeListoParams += `Tu pedido "${pedido.titulo}" ha sido completado.\n\n`;

    if (pedido.desea_version_digital) {
      // Si pidió versión digital, se envía por WhatsApp/correo
      mensajeListoParams += `📱 Tu trabajo está listo y será enviado por este medio (WhatsApp/Correo).\n\n`;
      mensajeListoParams += `Ten pendiente tu correo o WhatsApp para recibir los archivos.\n\n`;
    } else {
      // Si no pidió versión digital, es impresión física para retirar
      mensajeListoParams += `📍 Lugar de Retiro: ${pedido.zona?.sitio_entrega}\n`;
      mensajeListoParams += `🕐 Turno: ${TURNOS_ENTREGA_LABELS[pedido.turno_entrega]}\n`;
      mensajeListoParams += `📅 Fecha: ${new Date(pedido.fecha_entrega).toLocaleDateString('es-VE')}\n\n`;
      mensajeListoParams += `¡Tu trabajo está listo! No olvides pasar a buscarlo en el turno y lugar indicado.\n\n`;
    }

    mensajeListoParams += `¡Gracias por confiar en PrintaVe! 🙏`;

    const telefonoFormato = telefonoCliente.startsWith('58') ? telefonoCliente : `58${telefonoCliente}`;
    const mensajeEncodificado = encodeURIComponent(mensajeListoParams);

    return `https://wa.me/${telefonoFormato}?text=${mensajeEncodificado}`;
  };

  const getArchivosProcessados = async (pedidoId: string): Promise<ArchivoPedido[]> => {
    const { data } = await supabase
      .from('archivos_pedidos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .in('tipo_archivo', ['tarea_original', 'archivo_procesado']);
    return (data as ArchivoPedido[]) || [];
  };

  const handleSubirArchivos = async () => {
    if (!selectedPedido || archivosSeleccionados.length === 0) return;

    setSubiendo(true);

    try {
      for (const archivo of archivosSeleccionados) {
        // Subir archivo a Supabase Storage
        const nombreArchivo = `${selectedPedido.id}/${Date.now()}_${archivo.name}`;
        const { error: uploadError } = await supabase.storage
          .from('pedidos')
          .upload(nombreArchivo, archivo);

        if (uploadError) throw uploadError;

        // Obtener URL pública del archivo
        const { data: { publicUrl } } = supabase.storage
          .from('pedidos')
          .getPublicUrl(nombreArchivo);

        // Guardar registro en archivos_pedidos
        const { error: insertError } = await supabase
          .from('archivos_pedidos')
          .insert({
            pedido_id: selectedPedido.id,
            tipo_archivo: 'archivo_procesado',
            nombre_archivo: archivo.name,
            url_archivo: publicUrl,
          });

        if (insertError) throw insertError;
      }

      setArchivosSeleccionados([]);
      const archivosActualizados = await getArchivosProcessados(selectedPedido.id);
      setArchivos(archivosActualizados);
    } catch (error) {
      console.error('Error al subir archivos:', error);
    }

    setSubiendo(false);
  };

  const groupedPedidos = {
    porRevisar: pedidos.filter(p => p.estado === 'por_revisar'),
    enProceso: pedidos.filter(p => ['en_proceso', 'pago_por_verificar', 'pagado'].includes(p.estado)),
    enRevision: pedidos.filter(p => ['en_revision_cliente', 'cambios_solicitados'].includes(p.estado)),
    listo: pedidos.filter(p => p.estado === 'listo_para_entregar'),
    entregado: pedidos.filter(p => p.estado === 'entregado'),
  };

  if (loading) return <LoadingCard />;

  if (!user?.zona_id) {
    return (
      <div className="p-4 lg:p-6">
        <div className="card card-padding text-center text-gray-500">
          No tienes una zona asignada. Contacta al administrador.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Gestión de Pedidos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Zona: {user?.zona?.nombre || 'Sin zona'}
          </p>
        </div>
        <button onClick={() => { setLoading(true); fetchPedidos(); }} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroEstado('todos')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filtroEstado === 'todos'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          Todos ({pedidos.length})
        </button>
        {(['por_revisar', 'en_proceso', 'en_revision_cliente', 'listo_para_entregar', 'entregado'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFiltroEstado(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtroEstado === status
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {ESTADOS_PEDIDO_LABELS[status]} ({
              status === 'por_revisar' ? groupedPedidos.porRevisar.length :
              status === 'en_proceso' ? groupedPedidos.enProceso.length :
              status === 'en_revision_cliente' ? groupedPedidos.enRevision.length :
              status === 'listo_para_entregar' ? groupedPedidos.listo.length :
              groupedPedidos.entregado.length
            })
          </button>
        ))}
      </div>

      {/* Alert for new orders */}
      {groupedPedidos.porRevisar.length > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Tienes {groupedPedidos.porRevisar.length} pedido(s) pendientes por revisar
          </p>
        </div>
      )}

      {/* Pedidos Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pedidos.map((pedido) => (
          <div
            key={pedido.id}
            className={`card card-padding cursor-pointer hover:shadow-soft-lg transition-all ${
              pedido.estado === 'por_revisar' ? 'ring-2 ring-yellow-400' : ''
            }`}
            onClick={() => setSelectedPedido(pedido)}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <StatusBadge status={pedido.estado} />
              {pedido.desea_version_digital && (
                <span title="Cliente quiere versión digital">
                  <MessageCircle className="w-4 h-4 text-primary-500" />
                </span>
              )}
            </div>

            <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">{pedido.titulo}</h3>

            <div className="mt-3 space-y-1 text-sm text-gray-500 dark:text-gray-400">
              <p>{pedido.servicio?.nombre}</p>
              <p>{pedido.cliente?.nombre_completo}</p>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{TURNOS_ENTREGA_LABELS[pedido.turno_entrega]}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-400">
                {new Date(pedido.created_at).toLocaleDateString('es-VE')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {pedidos.length === 0 && (
        <div className="card card-padding text-center text-gray-500 dark:text-gray-400 py-12">
          No hay pedidos en esta categoría
        </div>
      )}

      {/* Detail Modal */}
      {selectedPedido && (
        <Modal
          isOpen={!!selectedPedido}
          onClose={() => { setSelectedPedido(null); setMotivoRechazo(''); }}
          title="Detalle del Pedido"
          size="xl"
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <StatusBadge status={selectedPedido.estado} />
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mt-2">
                  {selectedPedido.titulo}
                </h3>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Cliente</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedPedido.cliente?.nombre_completo}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Servicio</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedPedido.servicio?.nombre}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Entrega</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {TURNOS_ENTREGA_LABELS[selectedPedido.turno_entrega]} - {new Date(selectedPedido.fecha_entrega).toLocaleDateString('es-VE')}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Monto</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  ${selectedPedido.monto_usd.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Description */}
            {selectedPedido.descripcion && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                  {selectedPedido.descripcion}
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

            {/* Entrega Digital Info */}
            {selectedPedido.desea_version_digital && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-semibold text-green-900 dark:text-green-200 mb-2">
                  📱 Entrega Digital
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  {(selectedPedido as any).metodo_entrega_digital === 'whatsapp' ? (
                    <>Enviar por <strong>WhatsApp</strong></>
                  ) : (selectedPedido as any).metodo_entrega_digital === 'correo' ? (
                    <>Enviar por <strong>Correo</strong></>
                  ) : (
                    <>Cliente desea recibir versión digital del trabajo</>
                  )}
                </p>
              </div>
            )}

            {/* Estado actual y acciones */}
            {selectedPedido.estado === 'por_revisar' && (
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                {selectedPedido.servicio?.tipo === 'impresion' && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      📄 Verificación de Páginas
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Cliente indicó: <strong>{selectedPedido.detalle_impresion?.paginas || '?'} páginas</strong>
                    </p>

                    {archivos.length > 0 && (
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                        <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                          📥 Documento para verificar:
                        </p>
                        {archivos.map((archivo) => (
                          <a
                            key={archivo.id}
                            href={archivo.url_archivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 underline block mb-1"
                          >
                            🔗 {archivo.nombre_archivo}
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-blue-200 dark:border-blue-700 flex gap-2">
                      <button
                        onClick={() => {
                          setMotivoRechazo(`No coincide el número de páginas. Indicó ${selectedPedido.detalle_impresion?.paginas} páginas pero el documento tiene diferente cantidad.`);
                        }}
                        className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Páginas no coinciden
                      </button>
                    </div>

                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      ✓ Descarga y verifica el documento. Si las páginas no coinciden, haz clic en el botón rojo.
                    </p>
                  </div>
                )}
                <p className="font-medium text-gray-900 dark:text-white">¿Se puede realizar esta tarea?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleEstadoChange('rechazado', motivoRechazo)}
                    disabled={procesando || !motivoRechazo}
                    className="btn-danger flex-1"
                  >
                    <X className="w-4 h-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={() => handleEstadoChange('aprobado_para_pago')}
                    disabled={procesando}
                    className="btn-success flex-1"
                  >
                    <Check className="w-4 h-4" />
                    Aprobar
                  </button>
                </div>
                <div>
                  <label className="label">Motivo de rechazo (obligatorio si rechazas)</label>
                  <textarea
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    className="input min-h-20"
                    placeholder="Ej: El archivo está corrupto, el tema no está claro..."
                  />
                </div>
              </div>
            )}

            {selectedPedido.estado === 'aprobado_para_pago' && (
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white">Datos de Pago Listos</p>
                {config && selectedPedido.cliente?.telefono ? (
                  <a
                    href={generarLinkWhatsApp(selectedPedido, config) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-success w-full flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar Datos de Pago por WhatsApp
                  </a>
                ) : (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      El cliente no tiene teléfono registrado
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleEstadoChange('en_proceso')}
                  disabled={procesando}
                  className="btn-secondary w-full"
                >
                  <Check className="w-4 h-4" />
                  Marcar como En Proceso
                </button>
              </div>
            )}

            {selectedPedido.estado === 'en_proceso' && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white">La tarea está lista</p>

                {/* Upload archivo - Solo para servicios que requieren revisión */}
                {selectedPedido.servicio?.tipo !== 'impresion' && (
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <label className="label">Subir archivos de entrega</label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Puedes agregar múltiples archivos (fotos, comprobantes, etc.)
                  </p>

                  <input
                    type="file"
                    id={`file-input-${selectedPedido.id}`}
                    onChange={(e) => {
                      console.log('File selected:', e.target.files);
                      const file = e.target.files?.[0];
                      if (file) {
                        const exists = archivosSeleccionados.some(a => a.name === file.name && a.size === file.size);
                        if (!exists) {
                          console.log('Adding file:', file.name);
                          setArchivosSeleccionados(prev => [...prev, file]);
                        }
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                    accept="*/*"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(`file-input-${selectedPedido.id}`) as HTMLInputElement;
                      input?.click();
                    }}
                    className="w-full py-3 px-4 border-2 border-dashed border-primary-400 dark:border-primary-600 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 cursor-pointer font-medium transition-colors"
                  >
                    + Agregar archivo
                  </button>

                  {archivosSeleccionados.length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-gray-300 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        📎 {archivosSeleccionados.length} archivo(s) seleccionado(s):
                      </p>
                      {archivosSeleccionados.map((archivo, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            📄 {archivo.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setArchivosSeleccionados(archivosSeleccionados.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleSubirArchivos}
                        disabled={subiendo}
                        className="btn-success w-full"
                      >
                        <Check className="w-3 h-3" />
                        {subiendo ? 'Subiendo...' : `Subir ${archivosSeleccionados.length} archivo(s)`}
                      </button>
                    </div>
                  )}
                </div>
                )}

                {/* Archivos subidos */}
                {archivos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Archivos subidos ({archivos.length}):
                    </p>
                    {archivos.map((archivo) => (
                      <a
                        key={archivo.id}
                        href={archivo.url_archivo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                      >
                        <Eye className="w-4 h-4" />
                        {archivo.nombre_archivo}
                      </a>
                    ))}
                  </div>
                )}

                {selectedPedido.servicio?.tipo === 'impresion' ? (
                  <>
                    <button
                      onClick={() => handleEstadoChange('listo_para_entregar')}
                      disabled={procesando}
                      className="btn-success w-full"
                    >
                      <Check className="w-4 h-4" />
                      Marcar como Listo para Entregar
                    </button>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      La impresión está lista para ser entregada al cliente
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEstadoChange('en_revision_cliente')}
                      disabled={procesando || archivos.length === 0}
                      className="btn-primary w-full"
                    >
                      <Check className="w-4 h-4" />
                      Enviar a Revisión del Cliente
                    </button>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      El cliente podrá revisar la tarea y aprobarla o solicitar cambios (máx 2 revisiones)
                    </p>
                  </>
                )}
              </div>
            )}

            {selectedPedido.estado === 'en_revision_cliente' && (
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    ⏳ Esperando revisión del cliente...
                  </p>
                </div>
                {selectedPedido.cliente?.telefono && (
                  <a
                    href={generarLinkWhatsAppRevision(selectedPedido) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Notificar Cliente por WhatsApp
                  </a>
                )}
              </div>
            )}

            {selectedPedido.estado === 'cambios_solicitados' && (
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-xl">
                  <p className="text-sm font-medium text-pink-700 dark:text-pink-300 mb-2">
                    Cambios Solicitados:
                  </p>
                  <p className="text-sm text-pink-600 dark:text-pink-400">
                    {selectedPedido.motivo_cambios}
                  </p>
                </div>

                {selectedPedido.servicio?.tipo !== 'impresion' && (
                  <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <label className="label">Subir archivos con los cambios realizados</label>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Sube los archivos actualizados con los cambios solicitados
                    </p>

                    <input
                      type="file"
                      id={`file-input-cambios-${selectedPedido.id}`}
                      onChange={(e) => {
                        console.log('File selected:', e.target.files);
                        const file = e.target.files?.[0];
                        if (file) {
                          const exists = archivosSeleccionados.some(a => a.name === file.name && a.size === file.size);
                          if (!exists) {
                            console.log('Adding file:', file.name);
                            setArchivosSeleccionados(prev => [...prev, file]);
                          }
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                      accept="*/*"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById(`file-input-cambios-${selectedPedido.id}`) as HTMLInputElement;
                        input?.click();
                      }}
                      className="w-full py-3 px-4 border-2 border-dashed border-primary-400 dark:border-primary-600 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 cursor-pointer font-medium transition-colors"
                    >
                      + Agregar archivo
                    </button>

                    {archivosSeleccionados.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-gray-300 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          📎 {archivosSeleccionados.length} archivo(s) seleccionado(s):
                        </p>
                        {archivosSeleccionados.map((archivo, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              📄 {archivo.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => setArchivosSeleccionados(archivosSeleccionados.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={handleSubirArchivos}
                          disabled={subiendo || archivosSeleccionados.length === 0}
                          className="btn-primary w-full"
                        >
                          {subiendo ? 'Subiendo...' : `Subir ${archivosSeleccionados.length} archivo(s)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleEstadoChange('en_revision_cliente')}
                  disabled={procesando}
                  className="btn-primary w-full"
                >
                  <Check className="w-4 h-4" />
                  Cambios Realizados - Reenviar a Revisión
                </button>
              </div>
            )}

            {selectedPedido.estado === 'listo_para_entregar' && (
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white">Pedido Aprobado - Listo para Entregar</p>
                {selectedPedido.cliente?.telefono && (
                  <a
                    href={generarLinkWhatsAppListo(selectedPedido) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Notificar por WhatsApp (Listo para Entregar)
                  </a>
                )}

                <button
                  onClick={() => handleEstadoChange('entregado')}
                  disabled={procesando}
                  className="btn-success w-full"
                >
                  <Check className="w-4 h-4" />
                  Confirmar Entrega
                </button>

                {selectedPedido.desea_version_digital && selectedPedido.cliente?.telefono && (
                  <a
                    href={getWhatsAppLink(selectedPedido)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar Versión Digital por WhatsApp
                  </a>
                )}
              </div>
            )}

            {selectedPedido.estado === 'entregado' && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Pedido entregado correctamente
                </p>
              </div>
            )}

            {selectedPedido.motivo_rechazo && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Motivo del rechazo: {selectedPedido.motivo_rechazo}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
