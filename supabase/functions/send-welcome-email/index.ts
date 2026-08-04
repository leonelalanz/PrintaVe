import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Resend } from 'npm:resend@latest';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface WebhookPayload {
  type: string;
  record: {
    id: string;
    email: string;
    nombre_completo: string;
    created_at: string;
  };
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload: WebhookPayload = await req.json();

    // Solo procesar inserciones en la tabla perfiles
    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const { email, nombre_completo } = payload.record;

    // Enviar correo de bienvenida
    const response = await resend.emails.send({
      from: 'PrintaVe <noreply@printave.com>',
      to: email,
      subject: '¡Bienvenido a PrintaVe! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #123B76; text-align: center; margin-bottom: 20px;">
              ¡Bienvenido a PrintaVe! 🎉
            </h1>

            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Hola <strong>${nombre_completo}</strong>,
            </p>

            <p style="color: #555; font-size: 15px; line-height: 1.8;">
              Tu cuenta ha sido creada exitosamente en <strong>PrintaVe</strong>, tu plataforma de gestión de tareas e impresiones.
            </p>

            <div style="background-color: #f0f7ff; border-left: 4px solid #27B8E6; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #123B76; margin-top: 0;">¿Qué puedes hacer ahora?</h3>
              <ul style="color: #555; line-height: 1.8;">
                <li>✓ Crear nuevas tareas e impresiones</li>
                <li>✓ Hacer seguimiento a tus pedidos</li>
                <li>✓ Recibir notificaciones de estado</li>
                <li>✓ Gestionar tus pagos de forma segura</li>
              </ul>
            </div>

            <p style="color: #555; font-size: 15px; line-height: 1.8; margin-top: 20px;">
              Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
            </p>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${Deno.env.get('APP_URL') || 'https://printave.app'}/dashboard" style="background-color: #123B76; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Ir a mi Panel
              </a>
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
