import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';


import BackupSettings from '@/components/backups/BackupSettings';
import { BackupSyncHistory } from '@/components/backups/BackupSyncHistory';
import { TourBackupConfig } from '@/components/backups/TourBackupConfig';
import { BatchPhotoSync } from '@/components/backups/BatchPhotoSync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BackupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    const loadTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.rpc('get_user_tenants', { _user_id: user.id });
        if (data && data.length > 0) {
          setTenantId(data[0].tenant_id);
        }
      }
    };
    loadTenant();
  }, []);

  // Handle OAuth callback from redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'connected' || success === 'reconnected') {
      const message = success === 'reconnected' 
        ? 'Connection restored successfully' 
        : 'Google Drive connected successfully';
      toast.success(message);
      // Clear the URL params
      setSearchParams({});
      
      // Force reload to show updated data
      window.location.reload();
    } else if (error) {
      toast.error(`Connection error: ${error}`);
      // Clear the URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Backups</h1>
        </div>
        
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
            <TabsTrigger value="sync">🔄 Sync Photos</TabsTrigger>
            <TabsTrigger value="history">📜 History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="settings" className="space-y-6">
            {tenantId && (
              <>
                <BackupSettings tenantId={tenantId} />
                <TourBackupConfig tenantId={tenantId} />
              </>
            )}
          </TabsContent>

          <TabsContent value="sync">
            {tenantId && <BatchPhotoSync tenantId={tenantId} />}
          </TabsContent>
          
          <TabsContent value="history">
            {tenantId && <BackupSyncHistory tenantId={tenantId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BackupsPage;
