import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ChevronLeft, FileText, Clock, Calendar, MessageCircle, Copy, CheckCheck, AlertCircle, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBCVRate } from '../../hooks/useBCVRate';
import { LoadingCard } from '../../components/common/Loading';
import type { Servicio, Zona, Configuracion, DetalleImpresion, TipoServicio } from '../../types';
import { TURNOS_ENTREGA_LABELS, type TurnoEntrega } from '../../types';

interface Paso {
  numero: number;
  titulo: string;
  completado: boolean;
  activo: boolean;
}

export function NuevoPedidoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rate: tasaBcvApi } = useBCVRate();

  // Data
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [pasoActual, setPasoActual] = useState(1);
  const [cantidadUnidades, setCantidadUnidades] = useState(0);
  const [deseaImprimir, setDeseaImprimir] = useState(false);
  const [detalleImpresionServicio, setDetalleImpresionServicio] = useState({
    paginas: 1,
    copias: 1,
    color: false,
    tamano_hoja: 'carta' as 'carta' | 'oficio' | 'a4',
    tipo_papel: 'normal' as 'normal' | 'fotografico' | 'opalina',
    intercalado: false,
  });
  const [formData, setFormData] = useState({
    servicio_id: '',
    titulo: '',
    descripcion: '',
    detalle_impresion: {
      paginas: 1,
      copias: 1,
      color: false,
      tamano_hoja: 'carta' as 'carta' | 'oficio' | 'a4',
      tipo_papel: 'normal' as 'normal' | 'fotografico' | 'opalina',
      intercalado: false,
    },
    zona_id: '',
    turno_entrega: '' as TurnoEntrega | '',
    fecha_entrega: '',
    desea_version_digital: false,
    metodo_entrega_digital: 'whatsapp' as 'whatsapp' | 'correo',
    metodo_pago: '' as 'pago_movil' | 'transferencia' | 'zinli' | 'binance' | '',
    referencia_pago: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [archivosSeleccionados, setArchivosSeleccionados] = useState<File[]>([]);
  const [urlsArchivos, setUrlsArchivos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  // Computed
  const servicioSeleccionado = servicios.find(s => s.id === formData.servicio_id);
  const zonaSeleccionada = zonas.find(z => z.id === formData.zona_id);
  const esImpresion = servicioSeleccionado?.tipo === 'impresion';

  // Calcular precio
  const calcularPrecio = (): number => {
    if (!servicioSeleccionado) return 0;

    if (esImpresion) {
      // Precio base por página
      const precioPorPagina = formData.detalle_impresion.color ? 0.30 : 0.15;

      // Multiplicadores por tamaño
      const multiplicadorTamaño = {
        'carta': 1.0,
        'a4': 1.1,
        'oficio': 1.2
      }[formData.detalle_impresion.tamano_hoja] || 1.0;

      // Multiplicadores por tipo de papel
      const multiplicadorPapel = {
        'normal': 1.0,
        'opalina': 1.2,
        'fotografico': 1.5
      }[formData.detalle_impresion.tipo_papel] || 1.0;

      const precioBase = precioPorPagina *
        formData.detalle_impresion.paginas *
        formData.detalle_impresion.copias;

      return precioBase * multiplicadorTamaño * multiplicadorPapel;
    }

    // Para otros servicios con unidades
    let precioFinal = servicioSeleccionado.precio_base_usd;

    if (servicioSeleccionado.precio_por_unidad_adicional && cantidadUnidades > 0) {
      const precioAdicional = cantidadUnidades * servicioSeleccionado.precio_por_unidad_adicional;
      precioFinal += precioAdicional;
    }

    // Agregar costo de impresión si lo desea
    if (deseaImprimir) {
      const precioPorPagina = detalleImpresionServicio.color ? 0.30 : 0.15;
      const multiplicadorTamaño = {
        'carta': 1.0,
        'a4': 1.1,
        'oficio': 1.2
      }[detalleImpresionServicio.tamano_hoja] || 1.0;
      const multiplicadorPapel = {
        'normal': 1.0,
        'opalina': 1.2,
        'fotografico': 1.5
      }[detalleImpresionServicio.tipo_papel] || 1.0;

      const precioBase = precioPorPagina * detalleImpresionServicio.paginas * detalleImpresionServicio.copias;
      const precioImpresion = precioBase * multiplicadorTamaño * multiplicadorPapel;
      precioFinal += precioImpresion;
    }

    return precioFinal;
  };

  const precioUSD = calcularPrecio();
  const tasaBcvActual = tasaBcvApi || config?.tasa_bcv || 36.5;
  const precioBs = precioUSD * tasaBcvActual;

  // Validar anticipacion
  const validarAnticipacion = (): boolean => {
    if (!servicioSeleccionado || !formData.fecha_entrega || !formData.turno_entrega) return false;

    const ahora = new Date();
    // Parsear fecha en zona horaria local, no UTC
    const [year, month, day] = formData.fecha_entrega.split('-').map(Number);
    const horaEntrega = formData.turno_entrega === 'manana' ? 9 : 18;
    const minutos = formData.turno_entrega === 'manana' ? 0 : 30;

    const fechaEntrega = new Date(year, month - 1, day, horaEntrega, minutos, 0, 0);

    const horasNecesarias = servicioSeleccionado.horas_anticipacion;
    const horasDisponibles = (fechaEntrega.getTime() - ahora.getTime()) / (1000 * 60 * 60);

    return horasDisponibles >= horasNecesarias;
  };

  // Obtener fechas disponibles
  const getFechasDisponibles = (): { fecha: Date; turnos: TurnoEntrega[] }[] => {
    if (!servicioSeleccionado) return [];

    const fechas: { fecha: Date; turnos: TurnoEntrega[] }[] = [];
    const ahora = new Date();

    for (let i = 0; i < 7; i++) {
      const fecha = new Date(ahora);
      fecha.setDate(fecha.getDate() + i);
      fecha.setHours(0, 0, 0, 0);

      const turnos: TurnoEntrega[] = [];

      // Verificar turno mañana
      const fechaManana = new Date(fecha);
      fechaManana.setHours(9, 0, 0, 0);
      if (fechaManana.getTime() - ahora.getTime() >= servicioSeleccionado.horas_anticipacion * 60 * 60 * 1000) {
        turnos.push('manana');
      }

      // Verificar turno tarde
      const fechaTarde = new Date(fecha);
      fechaTarde.setHours(18, 30, 0, 0);
      if (fechaTarde.getTime() - ahora.getTime() >= servicioSeleccionado.horas_anticipacion * 60 * 60 * 1000) {
        turnos.push('tarde');
      }

      if (turnos.length > 0) {
        fechas.push({ fecha, turnos });
      }
    }

    return fechas;
  };

  useEffect(() => {
    const fetchData = async () => {
      const [serviciosRes, zonasRes, configRes] = await Promise.all([
        supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
        supabase.from('zonas').select('*').eq('activa', true).order('nombre'),
        supabase.from('configuracion').select('*').maybeSingle(),
      ]);

      if (serviciosRes.data) setServicios(serviciosRes.data as Servicio[]);
      if (zonasRes.data) setZonas(zonasRes.data as Zona[]);
      if (configRes.data) setConfig(configRes.data as Configuracion);

      // Pre-seleccionar zona del usuario o la primera disponible
      if (zonasRes.data && zonasRes.data.length > 0) {
        const zonaId = user?.zona_id || zonasRes.data[0].id;
        setFormData(prev => ({ ...prev, zona_id: zonaId }));
      }

      setLoading(false);
    };

    if (user) fetchData();
  }, [user]);

  const pasos: Paso[] = [
    { numero: 1, titulo: 'Servicio', completado: pasoActual > 1, activo: pasoActual === 1 },
    { numero: 2, titulo: 'Entrega', completado: pasoActual > 2, activo: pasoActual === 2 },
    { numero: 3, titulo: 'Confirmacion', completado: pasoActual === 3, activo: pasoActual === 3 },
  ];

  const validarPaso = (paso: number): boolean => {
    switch (paso) {
      case 1:
        if (!formData.servicio_id) { setError('Selecciona un servicio'); return false; }
        if (!formData.titulo.trim()) { setError('Ingresa un titulo para tu tarea'); return false; }
        if (!formData.descripcion?.trim()) { setError('Ingresa una descripción o instrucciones para la tarea'); return false; }
        if (archivosSeleccionados.length > 0) { setError('Debes subir los archivos seleccionados antes de continuar'); return false; }
        if (esImpresion) {
          if (formData.detalle_impresion.paginas < 1) {
            setError('Debes ingresar el número de páginas');
            return false;
          }
          if (formData.detalle_impresion.paginas > 500) {
            setError('Máximo 500 páginas por pedido');
            return false;
          }
        }
        return true;
      case 2:
        if (!formData.zona_id) { setError('Selecciona una zona de entrega'); return false; }
        if (!formData.fecha_entrega) { setError('Selecciona una fecha de entrega'); return false; }
        if (!formData.turno_entrega) { setError('Selecciona un turno de entrega'); return false; }
        if (!validarAnticipacion()) {
          setError(`Este servicio requiere ${servicioSeleccionado?.horas_anticipacion} horas de anticipacion`);
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSiguiente = () => {
    setError(null);
    if (validarPaso(pasoActual)) {
      setPasoActual(prev => Math.min(prev + 1, 3));
    }
  };

  const handleAnterior = () => {
    setPasoActual(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!user || !servicioSeleccionado) return;

    setSubmitting(true);
    setError(null);

    // Asegurar que el perfil existe
    const { data: profileExists } = await supabase
      .from('perfiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileExists) {
      // Crear perfil si no existe
      const { error: profileError } = await supabase.from('perfiles').insert({
        id: user.id,
        nombre_completo: user.nombre_completo,
        rol: 'cliente',
        zona_id: formData.zona_id,
      });

      if (profileError) {
        setError('Error al crear tu perfil: ' + profileError.message);
        setSubmitting(false);
        return;
      }
    }

    const detalleImpresionFinal = esImpresion
      ? formData.detalle_impresion
      : (deseaImprimir
          ? {
              ...detalleImpresionServicio,
              paginas: (servicioSeleccionado?.cantidad_incluida || 1) + cantidadUnidades
            }
          : null);

    console.log('DEBUG:', { esImpresion, deseaImprimir, cantidadUnidades, 'cantidad_incluida': servicioSeleccionado?.cantidad_incluida, 'paginas_finales': detalleImpresionFinal?.paginas });

    const pedidoData: any = {
      cliente_id: user.id,
      zona_id: formData.zona_id || user.zona_id,
      servicio_id: formData.servicio_id,
      titulo: formData.titulo,
      descripcion: formData.descripcion || null,
      detalle_impresion: detalleImpresionFinal,
      monto_usd: precioUSD,
      turno_entrega: formData.turno_entrega,
      fecha_entrega: formData.fecha_entrega,
      desea_version_digital: formData.desea_version_digital,
    };

    if (formData.desea_version_digital) {
      pedidoData.metodo_entrega_digital = formData.metodo_entrega_digital;
    }

    const { data: pedidosCreados, error: insertError } = await (supabase
      .from('pedidos')
      .insert(pedidoData as any)
      .select('id') as any);

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    // Guardar archivos si se cargaron
    if (urlsArchivos.length > 0 && pedidosCreados && pedidosCreados.length > 0) {
      const pedidoId = pedidosCreados[0].id;
      const archivosParaGuardar = urlsArchivos.map((url, idx) => ({
        pedido_id: pedidoId,
        tipo_archivo: 'tarea_original' as const,
        nombre_archivo: archivosSeleccionados[idx]?.name || `archivo_${idx + 1}`,
        url_archivo: url,
        descripcion: 'Archivo original de la tarea cargado por el cliente',
      }));

      await (supabase.from('archivos_pedidos') as any).insert(archivosParaGuardar);
    }

    // Notificar al empleado de la zona
    const zonaId = formData.zona_id || user.zona_id;
    const { data: empleados } = await supabase
      .from('perfiles')
      .select('id')
      .eq('zona_id', zonaId)
      .eq('rol', 'empleado')
      .eq('activo', true);

    if (empleados && empleados.length > 0) {
      await Promise.all(
        empleados.map(emp =>
          supabase.from('notificaciones').insert({
            usuario_id: emp.id,
            tipo: 'nuevo_pedido',
            titulo: 'Nuevo Pedido',
            mensaje: `Tienes un nuevo pedido de ${user.nombre_completo}: "${formData.titulo}"`,
            data: { servicio_tipo: servicioSeleccionado.tipo },
          })
        )
      );
    }

    navigate('/mis-pedidos');
  };

  const handleCopiar = (texto: string, campo: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(campo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const handleSubirArchivos = async (files: File[]) => {
    if (!user || files.length === 0) return;

    setSubiendo(true);
    setError(null);

    try {
      const nuevasUrls: string[] = [];

      for (const file of files) {
        // Subir archivo a Supabase
        const timestamp = Date.now();
        const nombreArchivo = `${timestamp}_${file.name}`;
        const ruta = `tarea_original/${user.id}/${nombreArchivo}`;

        const { error: uploadError } = await supabase.storage
          .from('pedidos')
          .upload(ruta, file);

        if (uploadError) {
          setError('Error al cargar archivo: ' + uploadError.message);
          setSubiendo(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('pedidos')
          .getPublicUrl(ruta);

        nuevasUrls.push(publicUrl);
      }

      setUrlsArchivos([...urlsArchivos, ...nuevasUrls]);
      setArchivosSeleccionados([]);
      setSubiendo(false);
    } catch (err) {
      console.error('Error al cargar:', err);
      setError('Error inesperado al cargar archivos');
      setSubiendo(false);
    }
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Nueva Tarea
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Completa los pasos para solicitar tu tarea
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8">
        {pasos.map((paso, index) => (
          <div key={paso.numero} className="flex items-center flex-1">
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  paso.completado
                    ? 'bg-success-500 text-white'
                    : paso.activo
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {paso.completado ? <Check className="w-5 h-5" /> : paso.numero}
              </div>
              <span
                className={`ml-2 text-sm font-medium hidden sm:block ${
                  paso.activo ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {paso.titulo}
              </span>
            </div>
            {index < pasos.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 bg-gray-200 dark:bg-gray-700" />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <div className="flex items-center gap-2 text-error-600 dark:text-error-400">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Paso 1: Servicio */}
      {pasoActual === 1 && (
        <div className="space-y-6 animate-fade-in">
          {/* Servicios */}
          <div>
            <label className="label">Selecciona el tipo de servicio</label>
            <div className="grid gap-3">
              {servicios.map((servicio) => (
                <button
                  key={servicio.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, servicio_id: servicio.id })}
                  className={`p-4 rounded-xl border transition-all text-left ${
                    formData.servicio_id === servicio.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{servicio.nombre}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{servicio.descripcion}</p>
                      {servicio.tipo !== 'impresion' && (
                        <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                          Desde ${servicio.precio_base_usd.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {servicio.horas_anticipacion}h min
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          
          {servicioSeleccionado && ['investigacion_basica', 'tarea_compleja', 'exposicion'].includes(servicioSeleccionado.tipo) && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                ✏️ Correcciones Permitidas
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Este servicio incluye <strong>máximo 2 correcciones/revisiones</strong> después de que se complete el trabajo. Una vez pagado, el empleado realizará la tarea y tú podrás revisar y solicitar cambios hasta 2 veces antes de la entrega final.
              </p>
            </div>
          )}

          {/* Titulo */}
          <div>
            <label className="label">Titulo de la tarea</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="input"
              placeholder="Ej: Ensayo de Literatura, Resumen de Historia..."
            />
          </div>

          {/* Cantidad de unidades adicionales (para servicios no impresión) */}
          {servicioSeleccionado && !esImpresion && servicioSeleccionado.unidad_nombre && (
            <div className="space-y-4">
              <div>
                <label className="label">
                  {servicioSeleccionado.unidad_nombre}s adicionales (opcional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={cantidadUnidades}
                  onChange={(e) => setCantidadUnidades(parseInt(e.target.value) || 0)}
                  className="input"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Precio base: ${servicioSeleccionado.precio_base_usd.toFixed(2)} (cubre {servicioSeleccionado.cantidad_incluida} {servicioSeleccionado.unidad_nombre}s)
                  {servicioSeleccionado.precio_por_unidad_adicional && ` • Adicional: $${servicioSeleccionado.precio_por_unidad_adicional.toFixed(2)}/${servicioSeleccionado.unidad_nombre}`}
                  {cantidadUnidades > 0 && ` = Total $${(servicioSeleccionado.precio_base_usd + (cantidadUnidades * (servicioSeleccionado.precio_por_unidad_adicional || 0))).toFixed(2)}`}
                </p>
              </div>

              {/* Opción de imprimir */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deseaImprimir}
                    onChange={(e) => setDeseaImprimir(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 mt-0.5"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">¿Deseas imprimir {servicioSeleccionado.nombre.toLowerCase()}?</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Incluye impresión con opciones de tamaño, tipo de papel y color
                    </p>
                  </div>
                </label>
              </div>

              {/* Detalles de impresión (si desea imprimir) */}
              {deseaImprimir && (
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-primary-300 dark:border-primary-700">
                  <h3 className="font-medium text-gray-900 dark:text-white">Detalles de impresión</h3>

                  {/* Tamaño de papel */}
                  <div>
                    <label className="label text-xs">Tamaño de Papel</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['carta', 'oficio', 'a4'].map(tamaño => (
                        <button
                          key={tamaño}
                          type="button"
                          onClick={() => setDetalleImpresionServicio({ ...detalleImpresionServicio, tamano_hoja: tamaño as any })}
                          className={`p-2 rounded-lg text-sm font-medium transition-all ${
                            detalleImpresionServicio.tamano_hoja === tamaño
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {tamaño.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tipo de papel */}
                  <div>
                    <label className="label text-xs">Tipo de Papel</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'normal', label: 'Normal' },
                        { id: 'fotografico', label: 'Fotográfico' },
                        { id: 'opalina', label: 'Opalina' }
                      ].map(tipo => (
                        <button
                          key={tipo.id}
                          type="button"
                          onClick={() => setDetalleImpresionServicio({ ...detalleImpresionServicio, tipo_papel: tipo.id as any })}
                          className={`p-2 rounded-lg text-sm font-medium transition-all ${
                            detalleImpresionServicio.tipo_papel === tipo.id
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {tipo.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="label text-xs mb-2">Color</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!detalleImpresionServicio.color}
                          onChange={() => setDetalleImpresionServicio({ ...detalleImpresionServicio, color: false })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-sm">BlancoNegro ($0.15/pág)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={detalleImpresionServicio.color}
                          onChange={() => setDetalleImpresionServicio({ ...detalleImpresionServicio, color: true })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-sm">Color ($0.30/pág)</span>
                      </label>
                    </div>
                  </div>

                  {/* Desglose de precio */}
                  <div className="text-sm text-gray-600 dark:text-gray-300 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {(() => {
                      const totalPaginas = (servicioSeleccionado?.cantidad_incluida || 1) + cantidadUnidades;
                      return (
                        <>
                          <div className="flex justify-between">
                            <span>Cálculo:</span>
                            <span>
                              {totalPaginas} pág × {detalleImpresionServicio.copias} copia(s)
                              × ${detalleImpresionServicio.color ? '0.30' : '0.15'}/pág
                              × {detalleImpresionServicio.tamano_hoja === 'carta' ? '1.0' : detalleImpresionServicio.tamano_hoja === 'a4' ? '1.1' : '1.2'} (tamaño)
                              × {detalleImpresionServicio.tipo_papel === 'normal' ? '1.0' : detalleImpresionServicio.tipo_papel === 'opalina' ? '1.2' : '1.5'} (papel)
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-lg text-primary-600 dark:text-primary-400 mt-1">
                            <span>Costo de impresión:</span>
                            <span>
                              ${(() => {
                                const precioPorPagina = detalleImpresionServicio.color ? 0.30 : 0.15;
                                const multTamaño = { 'carta': 1.0, 'a4': 1.1, 'oficio': 1.2 }[detalleImpresionServicio.tamano_hoja] || 1.0;
                                const multPapel = { 'normal': 1.0, 'opalina': 1.2, 'fotografico': 1.5 }[detalleImpresionServicio.tipo_papel] || 1.0;
                                return (precioPorPagina * totalPaginas * detalleImpresionServicio.copias * multTamaño * multPapel).toFixed(2);
                              })()}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detalles impresion */}
          {esImpresion && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <h3 className="font-medium text-gray-900 dark:text-white">Detalles de impresion</h3>

              {/* Alerta prominente de páginas */}
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg">
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-200 mb-2">
                  ⚠️ Información Importante
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  Debes indicar el <strong>número exacto de páginas</strong> del documento (o documentos) que deseas imprimir.
                  {urlsArchivos.length > 0 && (
                    <span className="block mt-2 font-semibold">
                      📎 Tienes {urlsArchivos.length} archivo(s) cargado(s) → Ingresa el número TOTAL de páginas de todos.
                    </span>
                  )}
                  Esto afecta directamente el costo final.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg border-2 border-orange-400 dark:border-orange-600">
                  <label className="label text-xs font-bold text-orange-600 dark:text-orange-400">📄 Páginas <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={formData.detalle_impresion.paginas}
                    onChange={(e) => setFormData({
                      ...formData,
                      detalle_impresion: { ...formData.detalle_impresion, paginas: parseInt(e.target.value) || 1 }
                    })}
                    className="input font-bold text-lg mt-2"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Total de páginas del documento
                  </p>
                </div>
                <div>
                  <label className="label text-xs">Copias</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.detalle_impresion.copias}
                    onChange={(e) => setFormData({
                      ...formData,
                      detalle_impresion: { ...formData.detalle_impresion, copias: parseInt(e.target.value) || 1 }
                    })}
                    className="input"
                  />
                </div>
              </div>

              {/* Tamaño de papel */}
              <div>
                <label className="label text-xs">Tamaño de Papel</label>
                <div className="grid grid-cols-3 gap-2">
                  {['carta', 'oficio', 'a4'].map(tamaño => (
                    <button
                      key={tamaño}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        detalle_impresion: { ...formData.detalle_impresion, tamano_hoja: tamaño as any }
                      })}
                      className={`p-2 rounded-lg text-sm font-medium transition-all ${
                        formData.detalle_impresion.tamano_hoja === tamaño
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {tamaño.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de papel */}
              <div>
                <label className="label text-xs">Tipo de Papel</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'fotografico', label: 'Fotográfico' },
                    { id: 'opalina', label: 'Opalina' }
                  ].map(tipo => (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        detalle_impresion: { ...formData.detalle_impresion, tipo_papel: tipo.id as any }
                      })}
                      className={`p-2 rounded-lg text-sm font-medium transition-all ${
                        formData.detalle_impresion.tipo_papel === tipo.id
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="label text-xs mb-2">Color</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!formData.detalle_impresion.color}
                      onChange={() => setFormData({
                        ...formData,
                        detalle_impresion: { ...formData.detalle_impresion, color: false }
                      })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">Blanco y Negro ($0.15/pag)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.detalle_impresion.color}
                      onChange={() => setFormData({
                        ...formData,
                        detalle_impresion: { ...formData.detalle_impresion, color: true }
                      })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm">Color ($0.30/pag)</span>
                  </label>
                </div>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span>Cálculo:</span>
                  <span>
                    {formData.detalle_impresion.paginas} pág × {formData.detalle_impresion.copias} copias
                    × ${formData.detalle_impresion.color ? '0.30' : '0.15'}/pág
                    × {formData.detalle_impresion.tamano_hoja === 'carta' ? '1.0' : formData.detalle_impresion.tamano_hoja === 'a4' ? '1.1' : '1.2'} (tamaño)
                    × {formData.detalle_impresion.tipo_papel === 'normal' ? '1.0' : formData.detalle_impresion.tipo_papel === 'opalina' ? '1.2' : '1.5'} (papel)
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg text-primary-600 dark:text-primary-400">
                  <span>Total:</span>
                  <span>${precioUSD.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Desea Versión Digital */}
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.desea_version_digital}
                onChange={(e) => setFormData({ ...formData, desea_version_digital: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 mt-0.5"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">¿Deseas recibir versión digital?</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Recibe tu trabajo en formato digital por WhatsApp o Correo
                </p>
              </div>
            </label>
          </div>

          {/* Método de Entrega Digital */}
          {formData.desea_version_digital && (
            <div>
              <label className="label">¿Por cuál medio prefieres recibir tu trabajo? (opcional)</label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-400 transition-colors" style={{ borderColor: formData.metodo_entrega_digital === 'whatsapp' ? 'var(--color-primary)' : '' }}>
                  <input
                    type="radio"
                    name="metodo_entrega"
                    value="whatsapp"
                    checked={formData.metodo_entrega_digital === 'whatsapp'}
                    onChange={(e) => setFormData({ ...formData, metodo_entrega_digital: e.target.value as 'whatsapp' | 'correo' })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">WhatsApp</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Recibe el archivo al instante</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-primary-400 transition-colors" style={{ borderColor: formData.metodo_entrega_digital === 'correo' ? 'var(--color-primary)' : '' }}>
                  <input
                    type="radio"
                    name="metodo_entrega"
                    value="correo"
                    checked={formData.metodo_entrega_digital === 'correo'}
                    onChange={(e) => setFormData({ ...formData, metodo_entrega_digital: e.target.value as 'whatsapp' | 'correo' })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Correo</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">A tu correo registrado</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Descripcion */}
          <div>
            <label className="label">Descripcion o instrucciones <span className="text-red-500">*</span></label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="input min-h-24"
              placeholder="Agrega detalles especificos sobre tu tarea..."
            />
          </div>

          {/* Cargar archivos */}
          <div>
            <label className="label">Archivos de la tarea (opcional)</label>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Sube fotos, documentos, o archivos con los detalles de tu tarea. Puedes agregar varios.
            </p>

            <div
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      setError('El archivo no debe superar 10MB');
                      return;
                    }
                    if (!archivosSeleccionados.find(a => a.name === file.name)) {
                      setArchivosSeleccionados([...archivosSeleccionados, file]);
                    }
                  }
                };
                input.click();
              }}
              className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-primary-400 transition-colors"
            >
              <div className="flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-medium">+ Agregar archivo</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PNG, JPG, PDF, DOCX, etc (máx 10MB)
                </p>
              </div>
            </div>

            {archivosSeleccionados.length > 0 && (
              <div className="mt-4 space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  ⚠️ Archivos no subidos ({archivosSeleccionados.length})
                </p>
                <div className="space-y-2">
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
                </div>
                <button
                  type="button"
                  onClick={() => handleSubirArchivos(archivosSeleccionados)}
                  disabled={subiendo}
                  className="btn-success w-full"
                >
                  <FileText className="w-4 h-4" />
                  {subiendo ? 'Subiendo...' : `Subir ${archivosSeleccionados.length} archivo(s)`}
                </button>
              </div>
            )}

            {urlsArchivos.length > 0 && (
              <div className="mt-4 p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-xl">
                <p className="text-sm font-medium text-success-900 dark:text-success-100 mb-2">
                  ✓ Archivos cargados ({urlsArchivos.length})
                </p>
                {urlsArchivos.map((url, idx) => (
                  <p key={idx} className="text-xs text-success-700 dark:text-success-300">
                    • Archivo {idx + 1} cargado exitosamente
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paso 2: Entrega */}
      {pasoActual === 2 && (
        <div className="space-y-6 animate-fade-in">
          {/* Zona */}
          <div>
            <label className="label">Zona de entrega</label>
            <select
              value={formData.zona_id}
              onChange={(e) => setFormData({ ...formData, zona_id: e.target.value })}
              className="input"
            >
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </select>
            {zonaSeleccionada && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Retiro en: {zonaSeleccionada.sitio_entrega}
              </p>
            )}
          </div>

          {/* Anticipacion info - Solo mostrar si no cumple el requisito */}
          {servicioSeleccionado && formData.fecha_entrega && formData.turno_entrega && !validarAnticipacion() && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                <Clock className="w-4 h-4" />
                <span>Este servicio requiere minimo {servicioSeleccionado.horas_anticipacion} horas de anticipacion</span>
              </div>
            </div>
          )}

          {/* Fechas y turnos */}
          <div>
            <label className="label">Selecciona fecha y turno de entrega</label>
            <div className="grid gap-2">
              {getFechasDisponibles().map(({ fecha, turnos }) => (
                <div key={fecha.toISOString()} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <p className="font-medium text-gray-900 dark:text-white mb-2">
                    {fecha.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <div className="flex gap-2">
                    {turnos.map((turno) => (
                      <button
                        key={turno}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          turno_entrega: turno,
                          fecha_entrega: fecha.toISOString().split('T')[0],
                        })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.turno_entrega === turno && formData.fecha_entrega === fecha.toISOString().split('T')[0]
                            ? 'bg-primary-500 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-primary-400'
                        }`}
                      >
                        {turno === 'manana' ? '9:00 AM' : '6:30 PM'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Paso 3: Confirmacion */}
      {pasoActual === 3 && (
        <div className="space-y-6 animate-fade-in">
          {/* Resumen */}
          <div className="card card-padding space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Resumen del Pedido</h3>

            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Servicio</span>
                <span className="font-medium text-gray-900 dark:text-white">{servicioSeleccionado?.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Titulo</span>
                <span className="font-medium text-gray-900 dark:text-white">{formData.titulo}</span>
              </div>

              {formData.descripcion && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Descripción</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    {formData.descripcion}
                  </p>
                </div>
              )}

              {/* Impresión */}
              {(esImpresion || deseaImprimir) && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">📋 Impresión: SÍ</p>
                  <div className="space-y-1 text-xs text-blue-600 dark:text-blue-400">
                    {!esImpresion ? (
                      <>
                        <p>• Páginas a imprimir: {(servicioSeleccionado?.cantidad_incluida || 1) + cantidadUnidades}
                          <span className="text-blue-500 dark:text-blue-300"> ({servicioSeleccionado?.cantidad_incluida || 1} base + {cantidadUnidades} adicionales)</span>
                        </p>
                      </>
                    ) : (
                      <p>• Páginas: {formData.detalle_impresion.paginas}</p>
                    )}
                    <p>• Copias: {esImpresion ? formData.detalle_impresion.copias : detalleImpresionServicio.copias}</p>
                    <p>• Color: {esImpresion ? (formData.detalle_impresion.color ? 'Sí (Color)' : 'No (B/N)') : (detalleImpresionServicio.color ? 'Sí (Color)' : 'No (B/N)')}</p>
                    <p>• Tamaño: {esImpresion ? formData.detalle_impresion.tamano_hoja.toUpperCase() : detalleImpresionServicio.tamano_hoja.toUpperCase()}</p>
                    <p>• Tipo de papel: {esImpresion ? formData.detalle_impresion.tipo_papel : detalleImpresionServicio.tipo_papel}</p>
                  </div>
                </div>
              )}

              {!esImpresion && !deseaImprimir && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">📋 Impresión: NO</p>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Entrega</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formData.fecha_entrega && new Date(formData.fecha_entrega).toLocaleDateString('es-VE')} -
                  {formData.turno_entrega && TURNOS_ENTREGA_LABELS[formData.turno_entrega]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Lugar</span>
                <span className="font-medium text-gray-900 dark:text-white">{zonaSeleccionada?.sitio_entrega}</span>
              </div>

              {formData.desea_version_digital && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Entrega Digital</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formData.metodo_entrega_digital === 'whatsapp' ? '📱 WhatsApp' : '📧 Correo'}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              {!esImpresion && servicioSeleccionado?.unidad_nombre && (
                <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Precio base (cubre {servicioSeleccionado.cantidad_incluida} {servicioSeleccionado.unidad_nombre}s):</span>
                    <span>${servicioSeleccionado.precio_base_usd.toFixed(2)}</span>
                  </div>
                  {cantidadUnidades > 0 && (
                    <div className="flex justify-between">
                      <span>{cantidadUnidades} {servicioSeleccionado.unidad_nombre}(s) adicional(es):</span>
                      <span>${(cantidadUnidades * (servicioSeleccionado.precio_por_unidad_adicional || 0)).toFixed(2)}</span>
                    </div>
                  )}
                  {deseaImprimir && (
                    <div className="flex justify-between">
                      {(() => {
                        const totalPaginasImpresion = (servicioSeleccionado?.cantidad_incluida || 1) + cantidadUnidades;
                        return (
                          <>
                            <span>Impresión ({totalPaginasImpresion} {totalPaginasImpresion === 1 ? 'pág' : 'págs'}, {detalleImpresionServicio.color ? 'color' : 'B/N'}, {detalleImpresionServicio.tamano_hoja.toUpperCase()}, {detalleImpresionServicio.tipo_papel}):</span>
                            <span>${(() => {
                              const precioPorPagina = detalleImpresionServicio.color ? 0.30 : 0.15;
                              const multTamaño = { 'carta': 1.0, 'a4': 1.1, 'oficio': 1.2 }[detalleImpresionServicio.tamano_hoja] || 1.0;
                              const multPapel = { 'normal': 1.0, 'opalina': 1.2, 'fotografico': 1.5 }[detalleImpresionServicio.tipo_papel] || 1.0;
                              return (precioPorPagina * totalPaginasImpresion * detalleImpresionServicio.copias * multTamaño * multPapel).toFixed(2);
                            })()}</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Monto USD</span>
                <span className="font-bold text-gray-900 dark:text-white">${precioUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Tasa BCV</span>
                <div className="text-right">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {tasaBcvActual.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/USD
                  </span>
                  {tasaBcvApi && config && tasaBcvApi !== config.tasa_bcv && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      (API en tiempo real)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-300">Total en Bolivares</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  Bs. {precioBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Info importante */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Importante:</strong> Tu pedido sera revisado por el empleado de tu zona.
              Una vez aprobado, recibirás una notificacion para proceder con el pago.
            </p>
          </div>
        </div>
      )}

      {/* Navegacion */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
        {pasoActual > 1 && (
          <button onClick={handleAnterior} className="btn-secondary flex-1">
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
        )}

        {pasoActual < 3 ? (
          <button onClick={handleSiguiente} className="btn-primary flex-1">
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting} className="btn-success flex-1">
            {submitting ? 'Enviando...' : 'Crear Pedido'}
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
