import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Logo } from '../../components/common/Logo';
import type { Zona } from '../../types';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    nombre_completo: '',
    email: '',
    telefono: '',
    password: '',
    confirm_password: '',
    zona_id: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zonas, setZonas] = useState<Zona[]>([]);

  const { signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchZonas = async () => {
      const { data } = await supabase
        .from('zonas')
        .select('*')
        .eq('activa', true)
        .order('nombre');
      if (data) setZonas(data);
    };
    fetchZonas();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirm_password) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!formData.zona_id) {
      setError('Debes seleccionar tu zona');
      return;
    }

    setLoading(true);

    const { error } = await signUp(
      formData.email,
      formData.password,
      formData.nombre_completo,
      formData.zona_id,
      formData.telefono
    );

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="card card-padding">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Crear Cuenta
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Únete a PrintaVe
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
              <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="nombre_completo" className="label">
              Nombre Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="nombre_completo"
                name="nombre_completo"
                type="text"
                value={formData.nombre_completo}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Tu nombre completo"
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input pl-10"
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="telefono" className="label">
              WhatsApp/Teléfono
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="telefono"
                name="telefono"
                type="tel"
                value={formData.telefono}
                onChange={handleChange}
                className="input pl-10"
                placeholder="+58 412 1234567"
                required
                autoComplete="tel"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Usaremos este número para enviarte los datos de pago por WhatsApp
            </p>
          </div>

          <div>
            <label htmlFor="zona_id" className="label">
              Tu Zona
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                id="zona_id"
                name="zona_id"
                value={formData.zona_id}
                onChange={handleChange}
                className="input pl-10"
                required
              >
                <option value="">Selecciona tu zona</option>
                {zonas.map((zona) => (
                  <option key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Esto determinará qué empleado atenderá tus pedidos
            </p>
          </div>

          <div>
            <label htmlFor="password" className="label">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                className="input pl-10 pr-10"
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm_password" className="label">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                value={formData.confirm_password}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Repite tu contraseña"
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
