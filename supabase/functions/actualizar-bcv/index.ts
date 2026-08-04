import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Llamar a la API de DolarAPI
    const response = await fetch('https://ve.dolarapi.com/v1/exchange-rates/usd');
    const data = await response.json();

    // Extraer la tasa BCV (oficial)
    const tasaBcv = data.official?.value;

    if (!tasaBcv) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener la tasa BCV' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Conectar a Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Actualizar la configuración
    const { data: updatedConfig, error } = await supabase
      .from('configuracion')
      .update({
        tasa_bcv: tasaBcv,
        fecha_actualizacion_tasa: new Date().toISOString(),
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasa_anterior: data.official?.value,
        tasa_nueva: tasaBcv,
        actualizado_en: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Error al actualizar la tasa BCV',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
