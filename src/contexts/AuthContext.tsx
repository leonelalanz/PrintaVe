import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserSession, Perfil, Zona, RolUsuario } from '../types';

interface AuthContextType {
  user: UserSession | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nombre_completo: string, zona_id?: string, telefono?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, email: string): Promise<UserSession | null> => {
    try {
      console.log('Fetching profile for user:', userId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const { data: perfil, error } = await supabase
          .from('perfiles')
          .select('id, nombre_completo, telefono, rol, zona_id')
          .eq('id', userId)
          .maybeSingle();

        clearTimeout(timeoutId);
        console.log('Profile query result:', { data: perfil, error });

        if (error) {
          console.error('Error fetching profile:', error);
          return null;
        }

        if (!perfil) {
          console.warn('No profile found for user:', userId);
          return null;
        }

        let zona: Zona | undefined;
        if (perfil.zona_id) {
          const { data: zonaData } = await supabase
            .from('zonas')
            .select('*')
            .eq('id', perfil.zona_id)
            .maybeSingle();
          zona = zonaData as Zona | undefined;
        }

        const userSession: UserSession = {
          id: userId,
          email,
          nombre_completo: perfil.nombre_completo,
          telefono: perfil.telefono,
          rol: perfil.rol as RolUsuario,
          zona_id: perfil.zona_id,
          zona,
        };

        console.log('Profile loaded successfully:', userSession);
        return userSession;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          console.error('Profile fetch timeout after 5 seconds');
        } else {
          console.error('Error fetching profile:', err);
        }
        return null;
      }
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const profile = await fetchProfile(session.user.id, session.user.email || '');
    setUser(profile);
  }, [session, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setSession(session);

      if (session?.user) {
        // Crear usuario temporal sin esperar el perfil
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          nombre_completo: session.user.user_metadata?.nombre_completo || 'Usuario',
          telefono: null,
          rol: 'cliente',
          zona_id: null,
          zona: undefined,
        });

        // Cargar perfil en background
        fetchProfile(session.user.id, session.user.email || '').then(profile => {
          if (profile) {
            setUser(profile);
          }
        }).catch(err => {
          console.error('Error fetching profile in background:', err);
        });
      } else {
        console.log('No session, clearing user');
        setUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, nombre_completo: string, zona_id?: string, telefono?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre_completo },
      },
    });

    if (error) return { error };

    if (data.user) {
      // Auto-login primero para que el usuario esté autenticado
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { error: signInError };
      }

      // Luego crear el perfil con la función RPC
      const { data: profileResult, error: profileError } = await supabase
        .from('perfiles')
        .insert({
          id: data.user.id,
          nombre_completo,
          telefono: telefono || null,
          rol: 'cliente',
          zona_id: zona_id || null,
        });

      if (profileError) {
        return { error: new Error(profileError.message) };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

export function useRequireAuth(allowedRoles?: RolUsuario[]) {
  const { user, loading } = useAuth();

  if (loading) return { authorized: false, loading: true, user: null };

  if (!user) return { authorized: false, loading: false, user: null };

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return { authorized: false, loading: false, user };
  }

  return { authorized: true, loading: false, user };
}
