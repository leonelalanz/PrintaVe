import { supabase } from './supabase';

const isDevelopment = !import.meta.env.PROD;

export const emailService = {
  /**
   * Envía correo de bienvenida al cliente registrado
   */
  async sendWelcomeEmail(email: string, nombreCompleto: string): Promise<boolean> {
    try {
      console.log('📧 Enviando correo de bienvenida a:', email);

      if (isDevelopment) {
        // En desarrollo, solo loguear
        console.log('✅ [DEV MODE] Correo de bienvenida simulado para:', {
          email,
          nombreCompleto,
          asunto: '¡Bienvenido a PrintaVe! 🎉',
        });
        return true;
      }

      // En producción, enviar via edge function
      const { data, error } = await supabase.functions.invoke('send-welcome-email', {
        body: {
          type: 'INSERT',
          record: {
            email,
            nombre_completo: nombreCompleto,
          },
        },
      });

      if (error) {
        console.error('❌ Error enviando correo:', error);
        return false;
      }

      console.log('✅ Correo enviado:', data);
      return true;
    } catch (error) {
      console.error('❌ Error en sendWelcomeEmail:', error);
      return false;
    }
  },

  /**
   * Envía correo al empleado cuando se le asigna una tarea
   */
  async sendTaskAssignmentEmail(pedidoId: string): Promise<boolean> {
    try {
      // Obtener datos del pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*, empleado:perfiles!empleado_id(*), cliente:perfiles!cliente_id(*), servicio:servicios(*)')
        .eq('id', pedidoId)
        .single();

      if (pedidoError || !pedido) {
        console.error('Error fetching pedido:', pedidoError);
        return false;
      }

      console.log('📧 Enviando correo de asignación al empleado');

      if (isDevelopment) {
        // En desarrollo, solo loguear
        console.log('✅ [DEV MODE] Correo de asignación simulado para:', {
          empleado: pedido.empleado?.nombre_completo,
          email: pedido.empleado?.email,
          tarea: pedido.titulo,
        });
        return true;
      }

      // En producción, enviar via edge function
      const { data, error } = await supabase.functions.invoke('send-task-assignment-email', {
        body: {
          type: 'UPDATE',
          record: pedido,
          old_record: { empleado_id: null },
        },
      });

      if (error) {
        console.error('Error sending task assignment email:', error);
        return false;
      }

      console.log('✅ Correo de asignación enviado:', data);
      return true;
    } catch (error) {
      console.error('Error sending task assignment email:', error);
      return false;
    }
  },
};
