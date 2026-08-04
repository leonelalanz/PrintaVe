# 📧 Configuración de Correos en PrintaVe

Este documento explica cómo configurar el sistema de envío de correos para PrintaVe usando Resend.

## 🚀 Requisitos

1. **Cuenta en Resend** - Regístrate en [resend.com](https://resend.com) (es gratuito)
2. **Supabase CLI** - Instalado localmente para desplegar funciones
3. **Variables de entorno configuradas**

## 📋 Pasos de Configuración

### 1. Crear cuenta en Resend

1. Ve a [resend.com](https://resend.com)
2. Crea una cuenta nueva
3. Obtén tu **API Key** de la sección "API Keys"
4. Guarda la clave en un lugar seguro

### 2. Configurar variables de entorno

Actualiza tu `.env` con:

```env
# Supabase
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key

# Supabase Service Role (para edge functions)
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Resend
RESEND_API_KEY=tu_resend_api_key

# URL de tu aplicación
APP_URL=http://localhost:5173  # Para desarrollo local
# APP_URL=https://printa-ve.vercel.app  # Para producción (Vercel)
# APP_URL=https://tu-dominio-personalizado.com  # Para producción (tu dominio)
```

Para obtener `SUPABASE_SERVICE_ROLE_KEY`:
1. Ve a Supabase Dashboard
2. Settings → API
3. Copia "service_role" key

### 3. Desplegar Edge Functions

En tu terminal, desde la carpeta del proyecto:

```bash
# Login a Supabase
supabase login

# Desplegar funciones
supabase functions deploy send-welcome-email
supabase functions deploy send-task-assignment-email

# Añadir secretos
supabase secrets set RESEND_API_KEY=tu_resend_api_key
supabase secrets set APP_URL=https://tu-dominio.com
```

### 4. Configurar Webhooks en Supabase

Ve a tu Supabase Dashboard y configura los webhooks:

#### Webhook 1: Correo de Bienvenida

1. **Tabla**: `perfiles`
2. **Eventos**: `INSERT`
3. **Método**: `POST`
4. **URL**: `https://tu-proyecto.supabase.co/functions/v1/send-welcome-email`
5. **Agregar encabezado**:
   - **Key**: `Authorization`
   - **Value**: `Bearer tu_service_role_key`

#### Webhook 2: Asignación de Tarea

1. **Tabla**: `pedidos`
2. **Eventos**: `UPDATE`
3. **Método**: `POST`
4. **URL**: `https://tu-proyecto.supabase.co/functions/v1/send-task-assignment-email`
5. **Agregar encabezado**:
   - **Key**: `Authorization`
   - **Value**: `Bearer tu_service_role_key`

## 🧪 Probar el Sistema

### Probar correo de bienvenida:
1. Ve a la página de registro
2. Crea una nueva cuenta
3. Deberías recibir un correo de bienvenida

### Probar correo de asignación:
1. Ve a la sección de pedidos como superadmin
2. Asigna un empleado a una tarea
3. El empleado debería recibir un correo

## 🐛 Troubleshooting

### "No recibo correos"

1. **Verifica Resend API Key**:
   ```bash
   curl -X GET https://api.resend.com/emails \
     -H 'Authorization: Bearer tu_resend_api_key'
   ```

2. **Revisa los logs de Supabase**:
   - Dashboard → Edge Functions → Ver logs

3. **Asegúrate que los webhooks están activos**:
   - Dashboard → Database → Webhooks

4. **Verifica dominios en Resend**:
   - Si usas un dominio personalizado, configúralo en Resend

### "Error de autorización"

Asegúrate que `SUPABASE_SERVICE_ROLE_KEY` está correctamente configurado en los secretos de Supabase.

### "Function timeout"

Las funciones pueden tomar más tiempo en la primera ejecución. Si el problema persiste, verifica tu conexión a internet y los logs.

## 📧 Personalizar Correos

Los templates de correos están en:
- `supabase/functions/send-welcome-email/index.ts` (línea ~25)
- `supabase/functions/send-task-assignment-email/index.ts` (línea ~63)

Puedes editar el HTML para personalizar:
- Colores de marca
- Logos
- Mensajes
- Links

## 🔗 URLs de Producción

### Opción A: Usar dominio de Vercel (Recomendado para empezar)

```bash
supabase secrets set APP_URL=https://printa-ve.vercel.app
```

✅ **Ventajas:**
- No requiere configuración adicional
- Los correos funcionan inmediatamente
- Perfecto para desarrollo y MVP
- Los correos vendrán desde `noreply@printave.com` (dominio de Resend)

### Opción B: Usar dominio personalizado (Opcional después)

Cuando quieras usar tu propio dominio (ej: info@tudominio.com):

1. Actualiza `APP_URL` en los secretos:
   ```bash
   supabase secrets set APP_URL=https://tu-dominio-personalizado.com
   ```

2. Configura el dominio en Resend:
   - Dashboard → Domains
   - Añade tu dominio
   - Resend te proporciona registros SPF y DKIM

3. Añade los registros SPF y DKIM en tu DNS (tu proveedor de dominio)

## ✅ Verificar Estado

```bash
# Ver funciones desplegadas
supabase functions list

# Ver logs en tiempo real
supabase functions logs send-welcome-email --follow
```

---

**Nota**: El primer envío de correo puede tardar 5-10 segundos. Esto es normal en la primera ejecución.
