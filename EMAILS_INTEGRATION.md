# 📧 Integración de Correos en PrintaVe

## ✅ Implementado

### 1. Correo de Bienvenida (Registro)
Ya está completamente integrado en `src/pages/auth/Register.tsx`

**Lo que hace:**
- Cuando un cliente se registra exitosamente
- Recibe automáticamente un correo de bienvenida
- El correo incluye instrucciones y link al dashboard

---

## 🔧 Integración Pendiente: Correo de Asignación de Tarea

Para enviar correos cuando se asigna un empleado a una tarea, necesitas integrar el servicio de email donde actualices `empleado_id` en la tabla `pedidos`.

### Ejemplo de Implementación

Si tienes un componente o función que actualiza un pedido y asigna un empleado, aquí está cómo hacerlo:

```tsx
import { emailService } from '../../lib/emailService';
import { supabase } from '../../lib/supabase';

// En tu función que asigna un empleado:
async function asignarEmpleado(pedidoId: string, empleadoId: string) {
  try {
    // 1. Actualizar el pedido con el nuevo empleado
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({ empleado_id: empleadoId })
      .eq('id', pedidoId);

    if (updateError) {
      console.error('Error actualizando pedido:', updateError);
      return false;
    }

    // 2. Enviar correo al empleado
    const emailSent = await emailService.sendTaskAssignmentEmail(pedidoId);
    
    if (emailSent) {
      console.log('✅ Correo de asignación enviado exitosamente');
    } else {
      console.warn('⚠️ No se pudo enviar el correo, pero la tarea fue asignada');
    }

    return true;
  } catch (error) {
    console.error('Error en asignación:', error);
    return false;
  }
}
```

### Dónde Integrar

**Busca en tu código:**
1. **Página de Superadmin de Pedidos** - Si existe una página para gestionar todos los pedidos
2. **Función que actualiza `empleado_id`** - En cualquier componente
3. **Modal de asignación** - Si hay un modal para asignar empleados
4. **Drag & Drop** - Si usas drag & drop para asignar

### Ejemplo con API Supabase Realtime

Si quieres que sea automático cada vez que se actualiza un pedido:

```tsx
// En el componente que muestra pedidos:
import { emailService } from '../../lib/emailService';

useEffect(() => {
  // Escuchar cambios en la tabla pedidos
  const channel = supabase
    .channel('pedidos-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
        filter: 'empleado_id=neq.null', // Solo si se asignó un empleado
      },
      async (payload) => {
        const pedido = payload.record;
        
        // Si el empleado cambió (era null y ahora tiene valor)
        if (!payload.old_record?.empleado_id && pedido.empleado_id) {
          await emailService.sendTaskAssignmentEmail(pedido.id);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## 🧪 Probar los Correos

### Probar Correo de Bienvenida
1. Ve a la página de registro
2. Crea una nueva cuenta
3. Deberías recibir un correo de bienvenida en pocos segundos

### Probar Correo de Asignación
1. Crea un nuevo pedido como cliente
2. Desde superadmin, asigna un empleado a ese pedido
3. El empleado debería recibir un correo

---

## 📍 Ubicación de los Servicios

- **Email Service**: `src/lib/emailService.ts`
- **Edge Functions**: `supabase/functions/send-*/`
- **Configuración**: `.env` (RESEND_API_KEY, etc.)

---

## ❓ Troubleshooting

### "No recibo correos"

1. **Verifica que Resend está configurado correctamente:**
   ```bash
   supabase secrets list
   ```
   Debería mostrar `RESEND_API_KEY`

2. **Revisa los logs de las edge functions:**
   ```bash
   supabase functions logs send-welcome-email --follow
   supabase functions logs send-task-assignment-email --follow
   ```

3. **Prueba directamente (para desarrolladores):**
   ```tsx
   import { emailService } from '../../lib/emailService';
   
   // En la consola del navegador:
   await emailService.sendWelcomeEmail('test@example.com', 'Test User')
   ```

### "Error 404 en la edge function"

Verifica que las funciones están desplegadas:
```bash
supabase functions list
```

Debería mostrar ambas funciones como `ACTIVE`

### "Error 401 Unauthorized"

Verifica que tu `VITE_SUPABASE_ANON_KEY` es correcta en el `.env`

---

## 🚀 Próximos Pasos (Opcional)

- [ ] Agregar plantillas de correo personalizadas por zona
- [ ] Registrar historial de correos enviados en DB
- [ ] Crear página de preferencias de notificación
- [ ] Integrar SMS via Twilio para empleados
- [ ] Usar dominio personalizado en Resend para branding

