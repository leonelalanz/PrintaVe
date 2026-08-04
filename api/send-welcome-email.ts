import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, nombre_completo } = req.body;

    if (!email || !nombre_completo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('📧 Enviando correo de bienvenida a:', email);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
                <a href="https://printa-ve.vercel.app/dashboard" style="background-color: #123B76; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
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
      }),
    });

    const data = await response.json();
    console.log('✅ Correo enviado exitosamente:', data);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('❌ Error enviando correo:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error instanceof Error ? error.message : String(error) });
  }
}
