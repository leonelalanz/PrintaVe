import { useState, useEffect } from 'react';

interface BCVRate {
  rate: number | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useBCVRate() {
  const [data, setData] = useState<BCVRate>({
    rate: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  useEffect(() => {
    const fetchRate = async () => {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }));

        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const result = await response.json();

        const tasaBcv = result.promedio || result.precio;

        if (!tasaBcv) {
          throw new Error('No se pudo obtener la tasa BCV. Respuesta: ' + JSON.stringify(result));
        }

        setData({
          rate: tasaBcv,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        });
      } catch (err) {
        setData(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Error al obtener la tasa',
        }));
      }
    };

    fetchRate();

    // Actualizar cada 1 hora
    const interval = setInterval(fetchRate, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return data;
}
