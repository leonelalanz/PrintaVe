import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingCard } from '../../components/common/Loading';
import type { Servicio } from '../../types';

export function PreciosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Servicio>>({});
  const [newServicio, setNewServicio] = useState<Partial<Servicio>>({ nombre: '', descripcion: '', precio_base_usd: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServicios();
  }, [user]);

  const fetchServicios = async () => {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .order('nombre');

    if (!error && data) {
      setServicios(data as Servicio[]);
    }
    setLoading(false);
  };

  const handleEdit = (servicio: Servicio) => {
    setEditingId(servicio.id);
    setEditData(servicio);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('servicios')
      .update({
        nombre: editData.nombre,
        descripcion: editData.descripcion,
        precio_base_usd: editData.precio_base_usd,
      })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchServicios();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este servicio?')) return;

    const { error } = await supabase
      .from('servicios')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchServicios();
    }
  };

  const handleAddNew = async () => {
    if (!newServicio.nombre || !newServicio.precio_base_usd) {
      alert('Por favor completa todos los campos');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('servicios')
      .insert({
        nombre: newServicio.nombre,
        descripcion: newServicio.descripcion || '',
        precio_base_usd: newServicio.precio_base_usd,
        tipo: 'tarea_compleja',
        horas_anticipacion: 24,
        activo: true,
      });

    if (!error) {
      setNewServicio({ nombre: '', descripcion: '', precio_base_usd: 0 });
      fetchServicios();
    }
    setSaving(false);
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Precios y Servicios
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gestiona los servicios y sus precios en USD
        </p>
      </div>

      {/* Servicios Existentes */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Servicios Registrados</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="table-header">Nombre del Servicio</th>
                <th className="table-header">Descripción</th>
                <th className="table-header text-right">Precio Base (USD)</th>
                <th className="table-header text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {servicios.map((servicio) => (
                <tr key={servicio.id}>
                  {editingId === servicio.id ? (
                    <>
                      <td className="table-cell">
                        <input
                          type="text"
                          value={editData.nombre || ''}
                          onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                          className="input text-sm"
                        />
                      </td>
                      <td className="table-cell">
                        <input
                          type="text"
                          value={editData.descripcion || ''}
                          onChange={(e) => setEditData({ ...editData, descripcion: e.target.value })}
                          className="input text-sm"
                        />
                      </td>
                      <td className="table-cell text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={editData.precio_base_usd || 0}
                          onChange={(e) => setEditData({ ...editData, precio_base_usd: parseFloat(e.target.value) })}
                          className="input text-sm w-32"
                        />
                      </td>
                      <td className="table-cell text-right space-x-2">
                        <button
                          onClick={() => handleSaveEdit(servicio.id)}
                          disabled={saving}
                          className="btn-success btn-sm"
                        >
                          <Save className="w-3 h-3" />
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn-secondary btn-sm"
                        >
                          <X className="w-3 h-3" />
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="table-cell font-medium">{servicio.nombre}</td>
                      <td className="table-cell text-sm text-gray-600 dark:text-gray-400">{servicio.descripcion || '-'}</td>
                      <td className="table-cell text-right font-medium">${(servicio.precio_base_usd || 0).toFixed(2)}</td>
                      <td className="table-cell text-right space-x-2">
                        <button
                          onClick={() => handleEdit(servicio)}
                          className="btn-primary btn-sm"
                        >
                          <Edit2 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(servicio.id)}
                          className="btn-danger btn-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agregar Nuevo Servicio */}
      <div className="card card-padding">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Agregar Nuevo Servicio
        </h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label text-xs">Nombre del Servicio</label>
            <input
              type="text"
              value={newServicio.nombre || ''}
              onChange={(e) => setNewServicio({ ...newServicio, nombre: e.target.value })}
              className="input"
              placeholder="Ej: Impresión"
            />
          </div>
          <div>
            <label className="label text-xs">Descripción</label>
            <input
              type="text"
              value={newServicio.descripcion || ''}
              onChange={(e) => setNewServicio({ ...newServicio, descripcion: e.target.value })}
              className="input"
              placeholder="Ej: Solo Impresión/Copias"
            />
          </div>
          <div>
            <label className="label text-xs">Precio Base (USD)</label>
            <input
              type="number"
              step="0.01"
              value={newServicio.precio_base_usd || 0}
              onChange={(e) => setNewServicio({ ...newServicio, precio_base_usd: parseFloat(e.target.value) })}
              className="input"
              placeholder="0.00"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddNew}
              disabled={saving}
              className="btn-primary w-full"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
