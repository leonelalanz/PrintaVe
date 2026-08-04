import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Resend } from 'npm:resend@latest';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

interface WebhookPayload {
  type: string;
  record: {
    id: string;
    empleado_id: string | null;
    titulo: string;
    estado: string;
  };
  old_record?: {
    empleado_id: string | null;
  };
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload: WebhookPayload = await req.json();

    // Solo procesar si se asignó un empleado a una tarea
    if (payload.type !== 'UPDATE' || !payload.record.empleado_id) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // Verificar que la asignación es nueva
    if (payload.old_record?.empleado_id === payload.record.empleado_id) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // Obtener datos del empleado
    const { data: empleado } = await supabase
      .from('perfiles')
      .select('email, nombre_completo')
      .eq('id', payload.record.empleado_id)
      .single();

    if (!empleado?.email) {
      return new Response(JSON.stringify({ error: 'Employee email not found' }), { status: 404 });
    }

    // Obtener datos del pedido (tarea)
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('*, cliente:perfiles!cliente_id(*), servicio:servicios(*)')
      .eq('id', payload.record.id)
      .single();

    if (!pedido) {
      return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });
    }

    // Enviar correo al empleado
    const response = await resend.emails.send({
      from: 'PrintaVe <noreply@printave.com>',
      to: empleado.email,
      subject: `Nueva Tarea Asignada: ${payload.record.titulo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #123B76; text-align: center; margin-bottom: 20px;">
              📋 Nueva Tarea Asignada
            </h1>

            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hola <strong>${empleado.nombre_completo}</strong>,
            </p>

            <p style="color: #555; font-size: 15px; line-height: 1.8;">
              Se te ha asignado una nueva tarea en PrintaVe. Aquí están los detalles:
            </p>

            <div style="background-color: #f0f7ff; border-left: 4px solid #27B8E6; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #123B76; margin-top: 0;">Detalles de la Tarea</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555; width: 30%;">Título:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">${payload.record.titulo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555;">Tipo de Servicio:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">${pedido.servicio?.nombre || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555;">Cliente:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">${pedido.cliente?.nombre_completo || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555;">Estado:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">
                    <span style="background-color: #FFB511; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                      ${getEstadoLabel(payload.record.estado)}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #555;">Fecha de Entrega:</td>
                  <td style="padding: 8px; color: #333;">${pedido.fecha_entrega ? new Date(pedido.fecha_entrega).toLocaleDateString('es-ES') : 'N/A'}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${Deno.env.get('APP_URL') || 'https://printave.app'}/pedidos" style="background-color: #123B76; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Ver Tarea Completa
              </a>
            </div>

            <div style="background-color: #fff3cd; border-left: 4px solid #FFB511; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⏰ Recordatorio:</strong> Asegúrate de completar esta tarea según los plazos indicados y mantener al cliente informado del progreso.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2026 PrintaVe. Todos los derechos reservados.
            </p>
          </div>
        </div>
      `,
    });

    if (response.error) {
      console.error('Error sending email:', response.error);
      return new Response(JSON.stringify({ error: response.error }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, messageId: response.data?.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    'por_revisar': 'Por Revisar',
    'rechazado': 'Rechazado',
    'aprobado_para_pago': 'Aprobado para Pago',
    'pago_por_verificar': 'Pago por Verificar',
    'en_proceso': 'En Proceso',
    'listo_para_retirar': 'Listo para Retirar',
    'entregado': 'Entregado',
    'cancelado': 'Cancelado',
  };
  return labels[estado] || estado;
}
