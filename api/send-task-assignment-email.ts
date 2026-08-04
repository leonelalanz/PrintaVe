import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { empleado_email, empleado_nombre, titulo, servicio_nombre, cliente_nombre, fecha_entrega } = req.body;

    if (!empleado_email || !titulo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('📧 Enviando correo de asignación a:', empleado_email);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PrintaVe <noreply@printave.com>',
        to: empleado_email,
        subject: `Nueva Tarea Asignada: ${titulo}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #123B76; text-align: center; margin-bottom: 20px;">
                📋 Nueva Tarea Asignada
              </h1>

              <p style="color: #333; font-size: 16px; line-height: 1.6;">
                Hola <strong>${empleado_nombre || 'Empleado'}</strong>,
              </p>

              <p style="color: #555; font-size: 15px; line-height: 1.8;">
                Se te ha asignado una nueva tarea en PrintaVe. Aquí están los detalles:
              </p>

              <div style="background-color: #f0f7ff; border-left: 4px solid #27B8E6; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <h3 style="color: #123B76; margin-top: 0;">Detalles de la Tarea</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555; width: 30%;">Título:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">${titulo}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555;">Tipo de Servicio:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">${servicio_nombre || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #555;">Cliente:</td>
                    <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #333;">${cliente_nombre || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; font-weight: bold; color: #555;">Fecha de Entrega:</td>
                    <td style="padding: 8px; color: #333;">${fecha_entrega ? new Date(fecha_entrega).toLocaleDateString('es-ES') : 'N/A'}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <a href="https://printa-ve.vercel.app/pedidos" style="background-color: #123B76; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Ver Tarea Completa
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

              <p style="color: #999; font-size: 12px; text-align: center;">
                © 2026 PrintaVe. Todos los derechos reservados.
              </p>
            </div>
          </div>
        `,
      }),
    });

    const data = await response.json();
    console.log('✅ Correo de asignación enviado:', data);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('❌ Error enviando correo de asignación:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error instanceof Error ? error.message : String(error) });
  }
}
