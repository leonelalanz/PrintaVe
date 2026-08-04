import { useState, useEffect } from 'react';
import { Plus, Edit2, User, Mail, MapPin, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingCard } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import type { Perfil, Zona } from '../../types';
import { ROLES_LABELS } from '../../types';

export function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Perfil[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Perfil | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre_completo: '',
    zona_id: '',
    rol: 'empleado',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [empleadosRes, zonasRes] = await Promise.all([
      supabase
        .from('perfiles')
        .select('*, zona:zonas(*)')
        .in('rol', ['empleado', 'superadmin'])
        .order('created_at', { ascending: false }),
      supabase.from('zonas').select('*').eq('activa', true),
    ]);

    if (!empleadosRes.error && empleadosRes.data) {
      setEmpleados(empleadosRes.data as Perfil[]);
    }
    if (!zonasRes.error && zonasRes.data) {
      setZonas(zonasRes.data as Zona[]);
    }
    setLoading(false);
  };

  const handleOpenModal = (empleado?: Perfil) => {
    if (empleado) {
      setEditingEmpleado(empleado);
      setFormData({
        email: '',
        password: '',
        nombre_completo: empleado.nombre_completo,
        zona_id: empleado.zona_id || '',
        rol: empleado.rol,
      });
    } else {
      setEditingEmpleado(null);
      setFormData({
        email: '',
        password: '',
        nombre_completo: '',
        zona_id: '',
        rol: 'empleado',
      });
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre_completo) {
      setError('El nombre es obligatorio');
      return;
    }

    if (!editingEmpleado && !formData.email) {
      setError('El correo es obligatorio');
      return;
    }

    if (!editingEmpleado && !formData.password) {
      setError('La contraseña es obligatoria');
      return;
    }

    if (formData.rol === 'empleado' && !formData.zona_id) {
      setError('Los empleados deben tener una zona asignada');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingEmpleado) {
        // Update existing
        const { error: updateError } = await supabase
          .from('perfiles')
          .update({
            nombre_completo: formData.nombre_completo,
            zona_id: formData.rol === 'empleado' ? formData.zona_id : null,
            rol: formData.rol as 'empleado' | 'superadmin',
          })
          .eq('id', editingEmpleado.id);

        if (updateError) throw updateError;
      } else {
        // Create new user via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('perfiles').insert({
            id: authData.user.id,
            nombre_completo: formData.nombre_completo,
            zona_id: formData.rol === 'empleado' ? formData.zona_id : null,
            rol: formData.rol as 'empleado' | 'superadmin',
          });

          if (profileError) throw profileError;
        }
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
    setSaving(false);
  };

  const handleToggleActive = async (empleado: Perfil) => {
    await supabase
      .from('perfiles')
      .update({ activo: !empleado.activo })
      .eq('id', empleado.id);
    fetchData();
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Gestión de Empleados
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Administra empleados y superadministradores
          </p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo Empleado
        </button>
      </div>

      {/* List */}
      <div className="card divide-y divide-gray-200 dark:divide-gray-800">
        {empleados.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay empleados registrados</p>
          </div>
        ) : (
          empleados.map((empleado) => (
            <div key={empleado.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!empleado.activo ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{empleado.nombre_completo}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {ROLES_LABELS[empleado.rol]}
                      </span>
                      {empleado.zona && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {empleado.zona.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleActive(empleado)} className="btn-icon">
                    {empleado.activo ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <X className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button onClick={() => handleOpenModal(empleado)} className="btn-icon">
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEmpleado ? 'Editar Empleado' : 'Nuevo Empleado'}
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          {!editingEmpleado && (
            <>
              <div>
                <label className="label">Correo Electrónico</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </>
          )}

          <div>
            <label className="label">Nombre Completo</label>
            <input
              type="text"
              value={formData.nombre_completo}
              onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Rol</label>
            <select
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
              className="input"
            >
              <option value="empleado">Empleado</option>
              <option value="superadmin">Super Administrador</option>
            </select>
          </div>

          {formData.rol === 'empleado' && (
            <div>
              <label className="label">Zona Asignada</label>
              <select
                value={formData.zona_id}
                onChange={(e) => setFormData({ ...formData, zona_id: e.target.value })}
                className="input"
              >
                <option value="">Seleccionar zona</option>
                {zonas.map((zona) => (
                  <option key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
