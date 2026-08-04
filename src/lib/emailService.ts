import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const emailService = {
  /**
   * Envía correo de bienvenida al cliente registrado
   */
  async sendWelcomeEmail(email: string, nombreCompleto: string): Promise<boolean> {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'INSERT',
          record: {
            email,
            nombre_completo: nombreCompleto,
          },
        }),
      });

      if (!response.ok) {
        console.error('Error sending welcome email:', response.statusText);
        return false;
      }

      console.log('Welcome email sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
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

      // Llamar la edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-task-assignment-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'UPDATE',
          record: pedido,
          old_record: { empleado_id: null },
        }),
      });

      if (!response.ok) {
        console.error('Error sending task assignment email:', response.statusText);
        return false;
      }

      console.log('Task assignment email sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending task assignment email:', error);
      return false;
    }
  },
};
