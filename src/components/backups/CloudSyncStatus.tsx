import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, CheckCircle, XCircle, Cloud } from 'lucide-react';

interface Props {
  backupJobId: string;
}

export const CloudSyncStatus: React.FC<Props> = ({ backupJobId }) => {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
    
    const interval = setInterval(() => {
      loadSyncStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [backupJobId]);

  const loadSyncStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_sync_history')
        .select('*')
        .eq('backup_job_id', backupJobId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      setSyncStatus(data);
      
      if (data && (data.status === 'completed' || data.status === 'failed')) {
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error loading sync status:', error);
      setLoading(false);
    }
  };

  if (!syncStatus) return null;

  return (
    <div className="flex items-center space-x-2 text-sm py-2 px-3 bg-accent/50 rounded-md">
      {syncStatus.status === 'in_progress' && (
        <>
          <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
          <span>
            Syncing to cloud... {syncStatus.files_synced || 0} files
          </span>
        </>
      )}
      {syncStatus.status === 'completed' && (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-green-600">
            ✅ Synced to cloud successfully ({syncStatus.files_synced} files)
          </span>
        </>
      )}
      {syncStatus.status === 'failed' && (
        <>
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-600">
            ❌ Cloud sync failed: {syncStatus.error_message}
          </span>
        </>
      )}
      {syncStatus.status === 'pending' && (
        <>
          <Cloud className="h-4 w-4 text-gray-500" />
          <span className="text-muted-foreground">
            Waiting to sync to cloud...
          </span>
        </>
      )}
    </div>
  );
};
