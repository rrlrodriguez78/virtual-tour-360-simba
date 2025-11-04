import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/custom-client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Detectar si estamos en modo offline (ruta especial)
    const isOfflineMode = window.location.pathname.startsWith('/offline-theta');
    
    if (isOfflineMode) {
      // En modo offline, no intentamos conectarnos a Supabase
      setLoading(false);
      return;
    }

    // Verificar si hay conexión a internet
    if (!navigator.onLine) {
      // Sin internet, marcamos como no cargando para no bloquear la UI
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session with timeout
    const checkSession = async () => {
      try {
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.warn('Session check failed (offline?):', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };

      // Check account status
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('account_status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error checking account status:', profileError);
          return { error: profileError };
        }

        if (profile?.account_status === 'pending') {
          await supabase.auth.signOut();
          return { 
            error: new Error('Tu cuenta está pendiente de aprobación por el administrador. Te notificaremos cuando sea aprobada.') as any 
          };
        }

        if (profile?.account_status === 'rejected') {
          await supabase.auth.signOut();
          return { 
            error: new Error('Tu solicitud de registro ha sido rechazada. Contacta al administrador si crees que esto es un error.') as any 
          };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          }
        }
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Redirigir a la página principal del dominio
    window.location.href = 'https://virtual-tour-360-simba.com/';
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/login`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, signIn, signUp, signOut, resetPassword, updatePassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};