/*
# PrintaVe - Esquema Completo MVP

## Descripción
Sistema PWA de gestión de tareas académicas para Venezuela con:
- 3 roles: Superadmin, Empleado, Cliente
- Múltiples zonas de operación (inicio: Alta Vista, Catia)
- 4 tipos de servicios con precios en USD
- Flujo de estados completo: Por Revisar → Aprobado para Pago → Pago por Verificar → En Proceso → Listo para Retirar → Entregado/Rechazado
- Métodos de pago venezolanos: Pago Móvil, Transferencia, Zinli, Binance
- Entregas presenciales en horarios fijos (9:00 AM o 6:30 PM)

## Tablas Nuevas
1. `zonas` - Zonas geográficas de operación
2. `perfiles` - Extensión de auth.users con rol y zona asignada
3. `servicios` - Catálogo de servicios con precios USD y anticipación
4. `configuracion` - Tasa BCV y datos de pago del Superadmin
5. `pedidos` - Solicitudes de tareas de clientes
6. `archivos_pedidos` - Archivos adjuntos y PDFs finales
7. `notificaciones` - Alertas del sistema
8. `logs_actividad` - Auditoría de acciones

## Seguridad
- RLS habilitado en todas las tablas
- Políticas diferenciadas por rol usando custom claims
- Clientes solo ven sus propios pedidos
- Empleados solo ven pedidos de su zona asignada
- Superadmin ve todo
*/

-- ============================================
-- ENUMS Y TIPOS PERSONALIZADOS
-- ============================================

DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('superadmin', 'empleado', 'cliente');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_pedido AS ENUM (
        'por_revisar',
        'rechazado',
        'aprobado_para_pago',
        'pago_por_verificar',
        'en_proceso',
        'listo_para_retirar',
        'entregado',
        'cancelado'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE metodo_pago AS ENUM ('pago_movil', 'transferencia', 'zinli', 'binance');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE turno_entrega AS ENUM ('manana', 'tarde');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_servicio AS ENUM ('impresion', 'investigacion_basica', 'tarea_compleja', 'exposicion');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TABLA: ZONAS
-- ============================================

CREATE TABLE IF NOT EXISTS zonas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL UNIQUE,
    descripcion text,
    sitio_entrega text NOT NULL,
    activa boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

INSERT INTO zonas (nombre, descripcion, sitio_entrega)
VALUES ('Alta Vista, Catia', 'Zona inicial de operaciones', 'Plaza principal de Alta Vista')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- TABLA: CONFIGURACIÓN DEL SISTEMA
-- ============================================

CREATE TABLE IF NOT EXISTS configuracion (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tasa_bcv numeric(12,2) NOT NULL DEFAULT 36.50,
    fecha_actualizacion_tasa timestamptz DEFAULT now(),
    pago_movil_banco text NOT NULL DEFAULT 'Banco de Venezuela',
    pago_movil_telefono text NOT NULL DEFAULT '04141234567',
    pago_movil_cedula text NOT NULL DEFAULT 'V-12345678',
    transferencia_banco text NOT NULL DEFAULT 'Banco de Venezuela',
    transferencia_cuenta text NOT NULL DEFAULT '01041234567890123456',
    transferencia_cedula text NOT NULL DEFAULT 'V-12345678',
    transferencia_nombre text NOT NULL DEFAULT 'Nombre Titular',
    zinli_email text NOT NULL DEFAULT 'correo@ejemplo.com',
    binance_id text NOT NULL DEFAULT 'binance_id_ejemplo',
    whatsapp_negocio text NOT NULL DEFAULT '04141234567',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT singleton_config CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

INSERT INTO configuracion (id, tasa_bcv)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 36.50)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TABLA: SERVICIOS
-- ============================================

CREATE TABLE IF NOT EXISTS servicios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo tipo_servicio NOT NULL UNIQUE,
    nombre text NOT NULL,
    descripcion text NOT NULL,
    precio_base_usd numeric(10,2) NOT NULL,
    precio_adicional text,
    horas_anticipacion integer NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now()
);

INSERT INTO servicios (tipo, nombre, descripcion, precio_base_usd, precio_adicional, horas_anticipacion) VALUES
('impresion', 'Solo Impresión/Copias', 'Impresión de documentos existentes', 0.00, 'B/N: $0.15 pág, Color: $0.30 pág', 3),
('investigacion_basica', 'Investigación Básica', 'Resúmenes, biografías, trabajos cortos', 3.00, NULL, 24),
('tarea_compleja', 'Tarea Compleja', 'Ensayos, informes largos, trabajos de investigación', 6.00, NULL, 48),
('exposicion', 'Exposición/Diseño de Láminas', 'Presentaciones y diseños profesionales', 5.00, NULL, 48)
ON CONFLICT (tipo) DO NOTHING;

-- ============================================
-- TABLA: PERFILES
-- ============================================

CREATE TABLE IF NOT EXISTS perfiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo text NOT NULL,
    telefono text,
    rol rol_usuario NOT NULL DEFAULT 'cliente',
    zona_id uuid REFERENCES zonas(id) ON DELETE SET NULL,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- TABLA: PEDIDOS
-- ============================================

CREATE TABLE IF NOT EXISTS pedidos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    zona_id uuid NOT NULL REFERENCES zonas(id),
    empleado_id uuid REFERENCES perfiles(id) ON DELETE SET NULL,
    servicio_id uuid NOT NULL REFERENCES servicios(id),
    titulo text NOT NULL,
    descripcion text,
    detalle_impresion jsonb,
    estado estado_pedido NOT NULL DEFAULT 'por_revisar',
    motivo_rechazo text,
    metodo_pago metodo_pago,
    referencia_pago text,
    monto_usd numeric(10,2) NOT NULL,
    monto_bs numeric(12,2),
    pago_verificado boolean DEFAULT false,
    fecha_pago timestamptz,
    verificado_por uuid REFERENCES perfiles(id),
    turno_entrega turno_entrega NOT NULL,
    fecha_entrega date NOT NULL,
    desea_version_digital boolean DEFAULT false,
    version_digital_enviada boolean DEFAULT false,
    fecha_creacion timestamptz DEFAULT now(),
    fecha_revision timestamptz,
    fecha_aprobacion_pago timestamptz,
    fecha_inicio_proceso timestamptz,
    fecha_listo timestamptz,
    fecha_entrega_real timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_zona ON pedidos(zona_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_empleado ON pedidos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_entrega ON pedidos(fecha_entrega);

-- ============================================
-- TABLA: ARCHIVOS PEDIDOS
-- ============================================

CREATE TABLE IF NOT EXISTS archivos_pedidos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    tipo_archivo text NOT NULL CHECK (tipo_archivo IN ('tarea_original', 'archivo_procesado')),
    nombre_archivo text NOT NULL,
    url_archivo text NOT NULL,
    descripcion text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archivos_pedido ON archivos_pedidos(pedido_id);

-- ============================================
-- TABLA: NOTIFICACIONES
-- ============================================

CREATE TABLE IF NOT EXISTS notificaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    leida boolean DEFAULT false,
    data jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_no_leidas ON notificaciones(usuario_id) WHERE NOT leida;

-- ============================================
-- TABLA: LOGS DE ACTIVIDAD
-- ============================================

CREATE TABLE IF NOT EXISTS logs_actividad (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES perfiles(id) ON DELETE SET NULL,
    accion text NOT NULL,
    entidad text NOT NULL,
    entidad_id uuid,
    detalles jsonb,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_actividad(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_fecha ON logs_actividad(created_at);

-- ============================================
-- FUNCIONES AUXILIARES
-- ============================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS rol_usuario AS $$
DECLARE
    user_rol rol_usuario;
BEGIN
    SELECT rol INTO user_rol FROM perfiles WHERE id = auth.uid();
    RETURN user_rol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_zone_empleado(zona_uuid uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM perfiles 
        WHERE id = auth.uid() 
        AND (rol = 'superadmin' OR (rol = 'empleado' AND zona_id = zona_uuid))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_empleado_zone()
RETURNS uuid AS $$
DECLARE
    zona uuid;
BEGIN
    SELECT zona_id INTO zona FROM perfiles WHERE id = auth.uid();
    RETURN zona;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- TRIGGER PARA updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_zonas_updated_at ON zonas;
CREATE TRIGGER trigger_zonas_updated_at BEFORE UPDATE ON zonas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_configuracion_updated_at ON configuracion;
CREATE TRIGGER trigger_configuracion_updated_at BEFORE UPDATE ON configuracion FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_perfiles_updated_at ON perfiles;
CREATE TRIGGER trigger_perfiles_updated_at BEFORE UPDATE ON perfiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_pedidos_updated_at ON pedidos;
CREATE TRIGGER trigger_pedidos_updated_at BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HABILITAR RLS
-- ============================================

ALTER TABLE zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_actividad ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS: ZONAS
-- ============================================

DROP POLICY IF EXISTS "zonas_select_all" ON zonas;
CREATE POLICY "zonas_select_all" ON zonas FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "zonas_insert_superadmin" ON zonas;
CREATE POLICY "zonas_insert_superadmin" ON zonas FOR INSERT
    TO authenticated WITH CHECK (get_user_role() = 'superadmin');

DROP POLICY IF EXISTS "zonas_update_superadmin" ON zonas;
CREATE POLICY "zonas_update_superadmin" ON zonas FOR UPDATE
    TO authenticated USING (get_user_role() = 'superadmin') WITH CHECK (get_user_role() = 'superadmin');

-- ============================================
-- POLÍTICAS RLS: CONFIGURACIÓN
-- ============================================

DROP POLICY IF EXISTS "config_select_all" ON configuracion;
CREATE POLICY "config_select_all" ON configuracion FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "config_update_superadmin" ON configuracion;
CREATE POLICY "config_update_superadmin" ON configuracion FOR UPDATE
    TO authenticated USING (get_user_role() = 'superadmin') WITH CHECK (get_user_role() = 'superadmin');

-- ============================================
-- POLÍTICAS RLS: SERVICIOS
-- ============================================

DROP POLICY IF EXISTS "servicios_select_all" ON servicios;
CREATE POLICY "servicios_select_all" ON servicios FOR SELECT
    TO authenticated USING (true);

DROP POLICY IF EXISTS "servicios_insert_superadmin" ON servicios;
CREATE POLICY "servicios_insert_superadmin" ON servicios FOR INSERT
    TO authenticated WITH CHECK (get_user_role() = 'superadmin');

DROP POLICY IF EXISTS "servicios_update_superadmin" ON servicios;
CREATE POLICY "servicios_update_superadmin" ON servicios FOR UPDATE
    TO authenticated USING (get_user_role() = 'superadmin') WITH CHECK (get_user_role() = 'superadmin');

-- ============================================
-- POLÍTICAS RLS: PERFILES
-- ============================================

DROP POLICY IF EXISTS "perfiles_select_own" ON perfiles;
CREATE POLICY "perfiles_select_own" ON perfiles FOR SELECT
    TO authenticated USING (auth.uid() = id OR get_user_role() = 'superadmin');

DROP POLICY IF EXISTS "perfiles_update_own" ON perfiles;
CREATE POLICY "perfiles_update_own" ON perfiles FOR UPDATE
    TO authenticated USING (auth.uid() = id OR get_user_role() = 'superadmin') 
    WITH CHECK (auth.uid() = id OR get_user_role() = 'superadmin');

DROP POLICY IF EXISTS "perfiles_insert_self" ON perfiles;
CREATE POLICY "perfiles_insert_self" ON perfiles FOR INSERT
    TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "perfiles_insert_superadmin" ON perfiles;
CREATE POLICY "perfiles_insert_superadmin" ON perfiles FOR INSERT
    TO authenticated WITH CHECK (get_user_role() = 'superadmin');

-- ============================================
-- POLÍTICAS RLS: PEDIDOS
-- ============================================

DROP POLICY IF EXISTS "pedidos_select_own" ON pedidos;
CREATE POLICY "pedidos_select_own" ON pedidos FOR SELECT
    TO authenticated USING (
        cliente_id = auth.uid()
    );

DROP POLICY IF EXISTS "pedidos_select_role" ON pedidos;
CREATE POLICY "pedidos_select_role" ON pedidos FOR SELECT
    TO authenticated USING (
        get_user_role() = 'superadmin'
        OR (get_user_role() = 'empleado' AND zona_id = get_empleado_zone())
    );

DROP POLICY IF EXISTS "pedidos_insert_client" ON pedidos;
CREATE POLICY "pedidos_insert_client" ON pedidos FOR INSERT
    TO authenticated WITH CHECK (
        cliente_id = auth.uid()
    );

DROP POLICY IF EXISTS "pedidos_update_own" ON pedidos;
CREATE POLICY "pedidos_update_own" ON pedidos FOR UPDATE
    TO authenticated USING (
        cliente_id = auth.uid()
    ) WITH CHECK (
        cliente_id = auth.uid()
    );

DROP POLICY IF EXISTS "pedidos_update_role" ON pedidos;
CREATE POLICY "pedidos_update_role" ON pedidos FOR UPDATE
    TO authenticated USING (
        get_user_role() = 'superadmin'
        OR (get_user_role() = 'empleado' AND zona_id = get_empleado_zone())
    ) WITH CHECK (
        get_user_role() = 'superadmin'
        OR (get_user_role() = 'empleado' AND zona_id = get_empleado_zone())
    );

-- ============================================
-- POLÍTICAS RLS: ARCHIVOS_PEDIDOS
-- ============================================

DROP POLICY IF EXISTS "archivos_select_role" ON archivos_pedidos;
CREATE POLICY "archivos_select_role" ON archivos_pedidos FOR SELECT
    TO authenticated USING (
        EXISTS (
            SELECT 1 FROM pedidos 
            WHERE pedidos.id = archivos_pedidos.pedido_id
            AND (
                get_user_role() = 'superadmin'
                OR pedidos.cliente_id = auth.uid()
                OR (get_user_role() = 'empleado' AND pedidos.zona_id = get_empleado_zone())
            )
        )
    );

DROP POLICY IF EXISTS "archivos_insert_role" ON archivos_pedidos;
CREATE POLICY "archivos_insert_role" ON archivos_pedidos FOR INSERT
    TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM pedidos 
            WHERE pedidos.id = archivos_pedidos.pedido_id
            AND (
                get_user_role() = 'superadmin'
                OR pedidos.cliente_id = auth.uid()
                OR (get_user_role() = 'empleado' AND pedidos.zona_id = get_empleado_zone())
            )
        )
    );

-- ============================================
-- POLÍTICAS RLS: NOTIFICACIONES
-- ============================================

DROP POLICY IF EXISTS "notif_select_own" ON notificaciones;
CREATE POLICY "notif_select_own" ON notificaciones FOR SELECT
    TO authenticated USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "notif_insert_system" ON notificaciones;
CREATE POLICY "notif_insert_system" ON notificaciones FOR INSERT
    TO authenticated WITH CHECK (
        get_user_role() = 'superadmin' OR usuario_id = auth.uid()
    );

DROP POLICY IF EXISTS "notif_update_own" ON notificaciones;
CREATE POLICY "notif_update_own" ON notificaciones FOR UPDATE
    TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- ============================================
-- POLÍTICAS RLS: LOGS ACTIVIDAD
-- ============================================

DROP POLICY IF EXISTS "logs_select_superadmin" ON logs_actividad;
CREATE POLICY "logs_select_superadmin" ON logs_actividad FOR SELECT
    TO authenticated USING (get_user_role() = 'superadmin');

DROP POLICY IF EXISTS "logs_insert_all" ON logs_actividad;
CREATE POLICY "logs_insert_all" ON logs_actividad FOR INSERT
    TO authenticated WITH CHECK (true);