import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Tenant {
  tenant_id: string;
  tenant_name: string;
  user_role: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  setCurrentTenant: (tenant: Tenant) => void;
  loading: boolean;
  isTenantAdmin: boolean;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_user_tenants' as any, {
        _user_id: user.id
      }) as { data: Tenant[] | null; error: any };

      if (error) throw error;

      const tenantsData = (data || []) as Tenant[];
      setTenants(tenantsData);
      
      // Set first tenant as current if none selected
      if (tenantsData.length > 0 && !currentTenant) {
        setCurrentTenant(tenantsData[0]);
      } else if (tenantsData.length === 0) {
        console.warn('Usuario no pertenece a ningún tenant');
        setCurrentTenant(null);
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
      setTenants([]);
      setCurrentTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, [user]);

  const isTenantAdmin = currentTenant?.user_role === 'tenant_admin' || currentTenant?.user_role === 'admin';

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenants,
        setCurrentTenant,
        loading,
        isTenantAdmin,
        refreshTenants: loadTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
