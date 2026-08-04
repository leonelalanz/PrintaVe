// ============================================
// TIPOS BASE (Enums del sistema)
// ============================================

export type RolUsuario = 'superadmin' | 'empleado' | 'cliente';

export type EstadoPedido =
  | 'por_revisar'
  | 'rechazado'
  | 'aprobado_para_pago'
  | 'pago_por_verificar'
  | 'pagado'
  | 'en_proceso'
  | 'en_revision_cliente'
  | 'cambios_solicitados'
  | 'listo_para_entregar'
  | 'entregado'
  | 'cancelado';

export type MetodoPago = 'pago_movil' | 'transferencia' | 'zinli' | 'binance';

export type TurnoEntrega = 'manana' | 'tarde';

export type TipoServicio = 'impresion' | 'investigacion_basica' | 'tarea_compleja' | 'exposicion';

// ============================================
// INTERFACES DE BASE DE DATOS
// ============================================

export interface Zona {
  id: string;
  nombre: string;
  descripcion: string | null;
  sitio_entrega: string;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Configuracion {
  id: string;
  tasa_bcv: number;
  fecha_actualizacion_tasa: string;
  pago_movil_banco: string;
  pago_movil_telefono: string;
  pago_movil_cedula: string;
  transferencia_banco: string;
  transferencia_cuenta: string;
  transferencia_cedula: string;
  transferencia_nombre: string;
  zinli_email: string;
  binance_id: string;
  whatsapp_negocio: string;
  created_at: string;
  updated_at: string;
}

export interface Servicio {
  id: string;
  tipo: TipoServicio;
  nombre: string;
  descripcion: string;
  precio_base_usd: number;
  precio_adicional: string | null;
  precio_por_unidad_adicional: number | null;
  unidad_nombre: string | null;
  cantidad_incluida: number | null;
  horas_anticipacion: number;
  limite_revisiones: number;
  activo: boolean;
  created_at: string;
}

export interface Perfil {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  rol: RolUsuario;
  zona_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  zona?: Zona;
}

export interface DetalleImpresion {
  paginas: number;
  copias: number;
  color: boolean;
  tamano_hoja: 'carta' | 'oficio' | 'a4';
  tipo_papel: 'normal' | 'fotografico' | 'opalina';
  intercalado: boolean;
}

export interface Pedido {
  id: string;
  cliente_id: string;
  zona_id: string;
  empleado_id: string | null;
  servicio_id: string;
  titulo: string;
  descripcion: string | null;
  detalle_impresion: DetalleImpresion | null;
  estado: EstadoPedido;
  motivo_rechazo: string | null;
  metodo_pago: MetodoPago | null;
  referencia_pago: string | null;
  monto_usd: number;
  monto_bs: number | null;
  pago_verificado: boolean;
  fecha_pago: string | null;
  verificado_por: string | null;
  turno_entrega: TurnoEntrega;
  fecha_entrega: string;
  desea_version_digital: boolean;
  version_digital_enviada: boolean;
  numero_revisiones: number;
  motivo_cambios: string | null;
  fecha_creacion: string;
  fecha_revision: string | null;
  fecha_aprobacion_pago: string | null;
  fecha_inicio_proceso: string | null;
  fecha_en_revision: string | null;
  fecha_listo: string | null;
  fecha_entrega_real: string | null;
  created_at: string;
  updated_at: string;
  cliente?: Perfil;
  zona?: Zona;
  empleado?: Perfil | null;
  servicio?: Servicio;
  archivos?: ArchivoPedido[];
}

export interface ArchivoPedido {
  id: string;
  pedido_id: string;
  tipo_archivo: 'tarea_original' | 'archivo_procesado';
  nombre_archivo: string;
  url_archivo: string;
  descripcion: string | null;
  created_at: string;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface LogActividad {
  id: string;
  usuario_id: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalles: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ============================================
// TIPOS DE APLICACIÓN
// ============================================

export interface UserSession {
  id: string;
  email: string;
  nombre_completo: string;
  telefono: string | null;
  rol: RolUsuario;
  zona_id: string | null;
  zona?: Zona;
}

export interface FiltrosReporte {
  fecha_inicio: string | null;
  fecha_fin: string | null;
  zona_id: string | null;
  servicio_id: string | null;
  empleado_id: string | null;
  estado: EstadoPedido | null;
}

export interface MetricasReporte {
  total_ingresos_usd: number;
  total_ingresos_bs: number;
  total_pedidos: number;
  pedidos_por_estado: Record<EstadoPedido, number>;
  servicios_mas_solicitados: { servicio: Servicio; cantidad: number }[];
  rendimiento_empleados: { empleado: Perfil; completados: number; rechazados: number }[];
}

export interface MetodoPagoInfo {
  id: MetodoPago;
  nombre: string;
  icono: string;
  campos: { label: string; value: string; key: string }[];
}

// ============================================
// ESTADOS DE UI
// ============================================

export type EstadoUI = 'idle' | 'loading' | 'success' | 'error';

export interface FormState<T> {
  data: T;
  estado: EstadoUI;
  error: string | null;
}

// ============================================
// TIPOS DEL STEPPER CLIENTE
// ============================================

export interface PasoServicio {
  servicio_id: string;
  titulo: string;
  descripcion: string;
  detalle_impresion?: DetalleImpresion;
}

export interface PasoEntrega {
  zona_id: string;
  turno_entrega: TurnoEntrega;
  fecha_entrega: string;
  desea_version_digital: boolean;
}

export interface PasoPago {
  metodo_pago: MetodoPago;
  referencia_pago: string;
}

export interface FormDataPedido {
  paso1: PasoServicio;
  paso2: PasoEntrega;
  paso3: PasoPago;
}

// ============================================
// HELPERS DE ESTADOS
// ============================================

export const ESTADOS_PEDIDO_LABELS: Record<EstadoPedido, string> = {
  por_revisar: 'Por Revisar',
  rechazado: 'Rechazado',
  aprobado_para_pago: 'Aprobado para Pago',
  pago_por_verificar: 'Pago por Verificar',
  pagado: 'Pagado',
  en_proceso: 'En Proceso',
  en_revision_cliente: 'En Revisión del Cliente',
  cambios_solicitados: 'Cambios Solicitados',
  listo_para_entregar: 'Listo para Entregar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ESTADOS_PEDIDO_COLORS: Record<EstadoPedido, string> = {
  por_revisar: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  rechazado: 'bg-red-100 text-red-800 border-red-200',
  aprobado_para_pago: 'bg-blue-100 text-blue-800 border-blue-200',
  pago_por_verificar: 'bg-orange-100 text-orange-800 border-orange-200',
  pagado: 'bg-teal-100 text-teal-800 border-teal-200',
  en_proceso: 'bg-purple-100 text-purple-800 border-purple-200',
  en_revision_cliente: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  cambios_solicitados: 'bg-pink-100 text-pink-800 border-pink-200',
  listo_para_entregar: 'bg-green-100 text-green-800 border-green-200',
  entregado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelado: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const TURNOS_ENTREGA_LABELS: Record<TurnoEntrega, string> = {
  manana: 'Turno Mañana (9:00 AM)',
  tarde: 'Turno Tarde (6:30 PM)',
};

export const METODOS_PAGO_LABELS: Record<MetodoPago, string> = {
  pago_movil: 'Pago Móvil',
  transferencia: 'Transferencia Bancaria',
  zinli: 'Zinli',
  binance: 'Binance',
};

export const ROLES_LABELS: Record<RolUsuario, string> = {
  superadmin: 'Super Administrador',
  empleado: 'Empleado',
  cliente: 'Cliente',
};
