export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      zonas: {
        Row: {
          id: string;
          nombre: string;
          descripcion: string | null;
          sitio_entrega: string;
          activa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          descripcion?: string | null;
          sitio_entrega: string;
          activa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          descripcion?: string | null;
          sitio_entrega?: string;
          activa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      configuracion: {
        Row: {
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
        };
        Insert: {
          id?: string;
          tasa_bcv?: number;
          fecha_actualizacion_tasa?: string;
          pago_movil_banco?: string;
          pago_movil_telefono?: string;
          pago_movil_cedula?: string;
          transferencia_banco?: string;
          transferencia_cuenta?: string;
          transferencia_cedula?: string;
          transferencia_nombre?: string;
          zinli_email?: string;
          binance_id?: string;
          whatsapp_negocio?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tasa_bcv?: number;
          fecha_actualizacion_tasa?: string;
          pago_movil_banco?: string;
          pago_movil_telefono?: string;
          pago_movil_cedula?: string;
          transferencia_banco?: string;
          transferencia_cuenta?: string;
          transferencia_cedula?: string;
          transferencia_nombre?: string;
          zinli_email?: string;
          binance_id?: string;
          whatsapp_negocio?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      servicios: {
        Row: {
          id: string;
          tipo: 'impresion' | 'investigacion_basica' | 'tarea_compleja' | 'exposicion';
          nombre: string;
          descripcion: string;
          precio_base_usd: number;
          precio_adicional: string | null;
          horas_anticipacion: number;
          activo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: 'impresion' | 'investigacion_basica' | 'tarea_compleja' | 'exposicion';
          nombre: string;
          descripcion: string;
          precio_base_usd: number;
          precio_adicional?: string | null;
          horas_anticipacion: number;
          activo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tipo?: 'impresion' | 'investigacion_basica' | 'tarea_compleja' | 'exposicion';
          nombre?: string;
          descripcion?: string;
          precio_base_usd?: number;
          precio_adicional?: string | null;
          horas_anticipacion?: number;
          activo?: boolean;
          created_at?: string;
        };
      };
      perfiles: {
        Row: {
          id: string;
          nombre_completo: string;
          telefono: string | null;
          rol: 'superadmin' | 'empleado' | 'cliente';
          zona_id: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nombre_completo: string;
          telefono?: string | null;
          rol?: 'superadmin' | 'empleado' | 'cliente';
          zona_id?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre_completo?: string;
          telefono?: string | null;
          rol?: 'superadmin' | 'empleado' | 'cliente';
          zona_id?: string | null;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      pedidos: {
        Row: {
          id: string;
          cliente_id: string;
          zona_id: string;
          empleado_id: string | null;
          servicio_id: string;
          titulo: string;
          descripcion: string | null;
          detalle_impresion: Json | null;
          estado: string;
          motivo_rechazo: string | null;
          metodo_pago: string | null;
          referencia_pago: string | null;
          monto_usd: number;
          monto_bs: number | null;
          pago_verificado: boolean;
          fecha_pago: string | null;
          verificado_por: string | null;
          turno_entrega: 'manana' | 'tarde';
          fecha_entrega: string;
          desea_version_digital: boolean;
          version_digital_enviada: boolean;
          fecha_creacion: string;
          fecha_revision: string | null;
          fecha_aprobacion_pago: string | null;
          fecha_inicio_proceso: string | null;
          fecha_listo: string | null;
          fecha_entrega_real: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          zona_id: string;
          empleado_id?: string | null;
          servicio_id: string;
          titulo: string;
          descripcion?: string | null;
          detalle_impresion?: Json | null;
          estado?: string;
          motivo_rechazo?: string | null;
          metodo_pago?: string | null;
          referencia_pago?: string | null;
          monto_usd: number;
          monto_bs?: number | null;
          pago_verificado?: boolean;
          fecha_pago?: string | null;
          verificado_por?: string | null;
          turno_entrega: 'manana' | 'tarde';
          fecha_entrega: string;
          desea_version_digital?: boolean;
          version_digital_enviada?: boolean;
          fecha_creacion?: string;
          fecha_revision?: string | null;
          fecha_aprobacion_pago?: string | null;
          fecha_inicio_proceso?: string | null;
          fecha_listo?: string | null;
          fecha_entrega_real?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          zona_id?: string;
          empleado_id?: string | null;
          servicio_id?: string;
          titulo?: string;
          descripcion?: string | null;
          detalle_impresion?: Json | null;
          estado?: string;
          motivo_rechazo?: string | null;
          metodo_pago?: string | null;
          referencia_pago?: string | null;
          monto_usd?: number;
          monto_bs?: number | null;
          pago_verificado?: boolean;
          fecha_pago?: string | null;
          verificado_por?: string | null;
          turno_entrega?: 'manana' | 'tarde';
          fecha_entrega?: string;
          desea_version_digital?: boolean;
          version_digital_enviada?: boolean;
          fecha_creacion?: string;
          fecha_revision?: string | null;
          fecha_aprobacion_pago?: string | null;
          fecha_inicio_proceso?: string | null;
          fecha_listo?: string | null;
          fecha_entrega_real?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      archivos_pedidos: {
        Row: {
          id: string;
          pedido_id: string;
          tipo_archivo: 'tarea_original' | 'archivo_procesado';
          nombre_archivo: string;
          url_archivo: string;
          descripcion: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pedido_id: string;
          tipo_archivo: 'tarea_original' | 'archivo_procesado';
          nombre_archivo: string;
          url_archivo: string;
          descripcion?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pedido_id?: string;
          tipo_archivo?: 'tarea_original' | 'archivo_procesado';
          nombre_archivo?: string;
          url_archivo?: string;
          descripcion?: string | null;
          created_at?: string;
        };
      };
      notificaciones: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: string;
          titulo: string;
          mensaje: string;
          leida: boolean;
          data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo: string;
          titulo: string;
          mensaje: string;
          leida?: boolean;
          data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string;
          tipo?: string;
          titulo?: string;
          mensaje?: string;
          leida?: boolean;
          data?: Json | null;
          created_at?: string;
        };
      };
      logs_actividad: {
        Row: {
          id: string;
          usuario_id: string | null;
          accion: string;
          entidad: string;
          entidad_id: string | null;
          detalles: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id?: string | null;
          accion: string;
          entidad: string;
          entidad_id?: string | null;
          detalles?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          usuario_id?: string | null;
          accion?: string;
          entidad?: string;
          entidad_id?: string | null;
          detalles?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {
      get_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_empleado_zone: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_zone_empleado: {
        Args: { zona_uuid: string };
        Returns: boolean;
      };
    };
    Enums: {
      rol_usuario: 'superadmin' | 'empleado' | 'cliente';
      estado_pedido:
        | 'por_revisar'
        | 'rechazado'
        | 'aprobado_para_pago'
        | 'pago_por_verificar'
        | 'en_proceso'
        | 'listo_para_retirar'
        | 'entregado'
        | 'cancelado';
      metodo_pago: 'pago_movil' | 'transferencia' | 'zinli' | 'binance';
      turno_entrega: 'manana' | 'tarde';
      tipo_servicio: 'impresion' | 'investigacion_basica' | 'tarea_compleja' | 'exposicion';
    };
  };
}
