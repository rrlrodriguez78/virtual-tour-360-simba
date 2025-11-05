import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export const useFeatureFlag = (featureKey: string): boolean => {
  const [isEnabled, setIsEnabled] = useState(false);
  const { currentTenant } = useTenant();

  useEffect(() => {
    const checkFeature = async () => {
      if (!currentTenant) {
        setIsEnabled(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_feature_enabled', {
          _tenant_id: currentTenant.tenant_id,
          _feature_key: featureKey
        });

        if (error) {
          console.error('Error checking feature flag:', error);
          setIsEnabled(false);
        } else {
          setIsEnabled(data || false);
        }
      } catch (error) {
        console.error('Error checking feature:', error);
        setIsEnabled(false);
      }
    };

    checkFeature();
  }, [featureKey, currentTenant]);

  return isEnabled;
};
