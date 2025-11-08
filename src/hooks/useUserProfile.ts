import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    if (!user) return;

    try {
      // Get avatar_url from user metadata
      const avatarUrl = user.user_metadata?.avatar_url || null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile({
        ...data,
        avatar_url: avatarUrl
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback to user email
      setProfile({
        full_name: null,
        email: user.email || '',
        avatar_url: user.user_metadata?.avatar_url || null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();

    // Subscribe to profile updates
    if (user) {
      const channel = supabase
        .channel('profile_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          () => {
            loadProfile();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const displayName = profile?.full_name || profile?.email || user?.email || '';

  return {
    profile,
    loading,
    displayName,
    refresh: loadProfile,
  };
};
