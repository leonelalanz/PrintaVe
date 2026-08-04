import { useState, useEffect } from 'react';
import { Save, RefreshCw, DollarSign, CreditCard, Wallet, Smartphone, Building, Mail, Hash, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBCVRate } from '../../hooks/useBCVRate';
import { LoadingCard } from '../../components/common/Loading';
import type { Configuracion } from '../../types';

export function ConfiguracionPage() {
  const { user } = useAuth();
  const { rate: tasaBcvApi, loading: loadingBcv } = useBCVRate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setConfig(data as Configuracion);
    }
    setLoading(false);
  };

  const handleChange = (field: keyof Configuracion, value: string | number) => {
    if (config) {
      setConfig({ ...config, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from('configuracion')
      .update({
        tasa_bcv: config.tasa_bcv,
        fecha_actualizacion_tasa: new Date().toISOString(),
        pago_movil_banco: config.pago_movil_banco,
        pago_movil_telefono: config.pago_movil_telefono,
        pago_movil_cedula: config.pago_movil_cedula,
        transferencia_banco: config.transferencia_banco,
        transferencia_cuenta: config.transferencia_cuenta,
        transferencia_cedula: config.transferencia_cedula,
        transferencia_nombre: config.transferencia_nombre,
        zinli_email: config.zinli_email,
        binance_id: config.binance_id,
        whatsapp_negocio: config.whatsapp_negocio,
      })
      .eq('id', config.id);

    if (updateError) {
      setError('Error al guardar la configuración');
    } else {
      setSuccess('Configuración actualizada correctamente');
    }
    setSaving(false);
  };

  const actualizarTasaDesdeAPI = () => {
    if (!config || !tasaBcvApi) return;
    setConfig({ ...config, tasa_bcv: tasaBcvApi });
    setSuccess('Tasa actualizada desde la API. Guarda los cambios.');
  };

  if (loading) return <LoadingCard />;

  if (!config) {
    return (
      <div className="p-4 lg:p-6">
        <div className="card card-padding text-center text-gray-500">
          No se encontró la configuración
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Configuración del Sistema
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestiona la tasa BCV y datos de pago
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800">
          <p className="text-sm text-success-600 dark:text-success-400">{success}</p>
        </div>
      )}

      {/* Tasa BCV */}
      <div className="card card-padding">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Tasa BCV</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Última actualización: {new Date(config.fecha_actualizacion_tasa).toLocaleDateString('es-VE')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Tasa actual de la API */}
          {!loadingBcv && tasaBcvApi && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Tasa BCV en Tiempo Real (API)</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {tasaBcvApi.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs/USD
                  </p>
                </div>
                <button
                  onClick={actualizarTasaDesdeAPI}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Check className="w-4 h-4" />
                  Usar
                </button>
              </div>
            </div>
          )}

          {/* Input para editar manual */}
          <div>
            <label htmlFor="tasa_bcv" className="label">
              Tasa Oficial Guardada (Bs por USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Bs.</span>
              <input
                id="tasa_bcv"
                type="number"
                step="0.01"
                value={config.tasa_bcv}
                onChange={(e) => handleChange('tasa_bcv', parseFloat(e.target.value))}
                className="input pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pago Móvil */}
      <div className="card card-padding">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <Smartphone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Pago Móvil</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Banco</label>
            <input
              type="text"
              value={config.pago_movil_banco}
              onChange={(e) => handleChange('pago_movil_banco', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input
              type="text"
              value={config.pago_movil_telefono}
              onChange={(e) => handleChange('pago_movil_telefono', e.target.value)}
              className="input"
              placeholder="04141234567"
            />
          </div>
          <div>
            <label className="label">Cédula</label>
            <input
              type="text"
              value={config.pago_movil_cedula}
              onChange={(e) => handleChange('pago_movil_cedula', e.target.value)}
              className="input"
              placeholder="V-12345678"
            />
          </div>
        </div>
      </div>

      {/* Transferencia */}
      <div className="card card-padding">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Transferencia Bancaria</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Banco</label>
            <input
              type="text"
              value={config.transferencia_banco}
              onChange={(e) => handleChange('transferencia_banco', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Número de Cuenta</label>
            <input
              type="text"
              value={config.transferencia_cuenta}
              onChange={(e) => handleChange('transferencia_cuenta', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Cédula</label>
            <input
              type="text"
              value={config.transferencia_cedula}
              onChange={(e) => handleChange('transferencia_cedula', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Nombre del Titular</label>
            <input
              type="text"
              value={config.transferencia_nombre}
              onChange={(e) => handleChange('transferencia_nombre', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Zinli y Binance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-padding">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Zinli</h2>
          </div>
          <div>
            <label className="label">Email de Zinli</label>
            <input
              type="email"
              value={config.zinli_email}
              onChange={(e) => handleChange('zinli_email', e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="card card-padding">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
              <Hash className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Binance</h2>
          </div>
          <div>
            <label className="label">ID de Binance Pay</label>
            <input
              type="text"
              value={config.binance_id}
              onChange={(e) => handleChange('binance_id', e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
