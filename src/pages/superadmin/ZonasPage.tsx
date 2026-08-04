import { useState, useEffect } from 'react';
import { Plus, Edit2, MapPin, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingCard } from '../../components/common/Loading';
import { Modal } from '../../components/common/Modal';
import type { Zona } from '../../types';

export function ZonasPage() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZona, setEditingZona] = useState<Zona | null>(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', sitio_entrega: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchZonas();
  }, []);

  const fetchZonas = async () => {
    const { data, error } = await supabase
      .from('zonas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setZonas(data as Zona[]);
    }
    setLoading(false);
  };

  const handleOpenModal = (zona?: Zona) => {
    if (zona) {
      setEditingZona(zona);
      setFormData({
        nombre: zona.nombre,
        descripcion: zona.descripcion || '',
        sitio_entrega: zona.sitio_entrega,
      });
    } else {
      setEditingZona(null);
      setFormData({ nombre: '', descripcion: '', sitio_entrega: '' });
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.sitio_entrega) {
      setError('El nombre y sitio de entrega son obligatorios');
      return;
    }

    setSaving(true);
    setError(null);

    let error;
    if (editingZona) {
      const result = await supabase
        .from('zonas')
        .update({
          nombre: formData.nombre,
          descripcion: formData.descripcion || null,
          sitio_entrega: formData.sitio_entrega,
        })
        .eq('id', editingZona.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('zonas')
        .insert({
          nombre: formData.nombre,
          descripcion: formData.descripcion || null,
          sitio_entrega: formData.sitio_entrega,
        });
      error = result.error;
    }

    if (error) {
      setError(error.message);
    } else {
      setModalOpen(false);
      fetchZonas();
    }
    setSaving(false);
  };

  const handleToggleActive = async (zona: Zona) => {
    await supabase
      .from('zonas')
      .update({ activa: !zona.activa })
      .eq('id', zona.id);
    fetchZonas();
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Gestión de Zonas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Administra las zonas de operación
          </p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="w-4 h-4" />
          Nueva Zona
        </button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zonas.map((zona) => (
          <div key={zona.id} className={`card card-padding ${!zona.activa ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{zona.nombre}</h3>
                </div>
                {zona.descripcion && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{zona.descripcion}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                  <span className="font-medium">Entrega:</span> {zona.sitio_entrega}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggleActive(zona)} className="btn-icon">
                  {zona.activa ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <button onClick={() => handleOpenModal(zona)} className="btn-icon">
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingZona ? 'Editar Zona' : 'Nueva Zona'}
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <div>
            <label className="label">Nombre de la Zona</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="input"
              placeholder="Ej: Alta Vista, Catia"
            />
          </div>

          <div>
            <label className="label">Descripción (opcional)</label>
            <input
              type="text"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="input"
              placeholder="Breve descripción"
            />
          </div>

          <div>
            <label className="label">Sitio de Entrega</label>
            <input
              type="text"
              value={formData.sitio_entrega}
              onChange={(e) => setFormData({ ...formData, sitio_entrega: e.target.value })}
              className="input"
              placeholder="Ej: Plaza principal de Alta Vista"
            />
          </div>

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
