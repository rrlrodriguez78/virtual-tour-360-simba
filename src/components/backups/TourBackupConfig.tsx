import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Cloud, HardDrive, Calendar, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTourBackupConfig } from '@/hooks/useTourBackupConfig';
import { toast } from 'sonner';

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  created_at: string;
}

interface BackupDestination {
  id: string;
  cloud_provider: string;
  is_active: boolean;
}

interface TourBackupConfigProps {
  tenantId: string;
}

export const TourBackupConfig: React.FC<TourBackupConfigProps> = ({ tenantId }) => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [destination, setDestination] = useState<BackupDestination | null>(null);
  const [loadingTours, setLoadingTours] = useState(true);
  const [loadingDestination, setLoadingDestination] = useState(true);
  
  const {
    configs,
    loading: loadingConfigs,
    enableAutoBackup,
    disableAutoBackup,
    updateConfig,
    getConfigForTour,
  } = useTourBackupConfig(tenantId);

  useEffect(() => {
    loadTours();
    loadDestination();
  }, [tenantId]);

  useEffect(() => {
    // Cuando hay destination y tours cargados, habilitar auto-backup para tours existentes sin config
    if (destination && tours.length > 0 && !loadingConfigs) {
      enableBackupForExistingTours();
    }
  }, [destination, tours, loadingConfigs]);

  const enableBackupForExistingTours = async () => {
    try {
      const { data, error } = await supabase.rpc('enable_auto_backup_for_existing_tours', {
        p_tenant_id: tenantId
      });
      
      if (error) throw error;
      
      if (data && data[0]?.configs_created > 0) {
        console.log(`Auto-backup habilitado para ${data[0].configs_created} tours existentes`);
        // Recargar configs para mostrar los cambios
        window.location.reload();
      }
    } catch (error) {
      console.error('Error enabling auto-backup for existing tours:', error);
    }
  };

  const loadTours = async () => {
    try {
      const { data, error } = await supabase
        .from('virtual_tours')
        .select('id, title, description, is_published, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTours(data || []);
    } catch (error) {
      console.error('Error loading tours:', error);
      toast.error('Error loading tours');
    } finally {
      setLoadingTours(false);
    }
  };

  const loadDestination = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_destinations')
        .select('id, cloud_provider, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setDestination(data);
    } catch (error) {
      console.error('Error loading destination:', error);
    } finally {
      setLoadingDestination(false);
    }
  };

  const handleToggleAutoBackup = async (tourId: string, enabled: boolean) => {
    if (enabled && !destination) {
      toast.error('Connect Google Drive first');
      return;
    }

    if (enabled && destination && !destination.is_active) {
      toast.error('Google Drive destination is inactive. Reconnect it first.');
      return;
    }

    if (enabled && destination) {
      await enableAutoBackup(tourId, destination.id);
      toast.success('Auto-backup enabled for this tour');
      
      // Trigger manual de backup inicial
      try {
        const { error } = await supabase
          .from('virtual_tours')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', tourId);
        
        if (error) throw error;
      } catch (error) {
        console.error('Error triggering manual backup:', error);
      }
    } else {
      await disableAutoBackup(tourId);
      toast.success('Auto-backup disabled for this tour');
    }
  };

  const handleChangeBackupType = async (tourId: string, backupType: 'full_backup' | 'media_only') => {
    await updateConfig(tourId, { backup_type: backupType });
  };

  const handleChangeFrequency = async (tourId: string, frequency: 'immediate' | 'daily' | 'weekly') => {
    await updateConfig(tourId, { backup_frequency: frequency });
  };

  if (loadingTours || loadingDestination || loadingConfigs) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!destination) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⚠️ Google Drive Not Connected</CardTitle>
          <CardDescription>
            Before configuring automatic backups, connect your Google Drive account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base md:text-sm text-muted-foreground mb-4">
            Connect your Google Drive account above to enable automatic backups.
            Once connected, all new tours will be backed up automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configure Auto-Backup per Tour
        </CardTitle>
        <CardDescription>
          All new tours are automatically backed up to Google Drive. 
          You can disable backup for specific tours using the switch on the right.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tours.length === 0 ? (
          <p className="text-base md:text-sm text-muted-foreground text-center py-8">
            No tours created yet. Create a tour to configure automatic backups.
          </p>
        ) : (
          tours.map((tour) => {
            const config = getConfigForTour(tour.id);
            const isEnabled = config?.auto_backup_enabled || false;

            return (
              <div
                key={tour.id}
                className="flex flex-col md:flex-row md:items-start md:justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-base md:text-sm">{tour.title}</h3>
                    {isEnabled ? (
                      <Badge variant="secondary" className="text-xs">
                        <Cloud className="h-3 w-3 mr-1" />
                        Auto-backup
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs opacity-60">
                        No backup
                      </Badge>
                    )}
                  </div>
                  <p className="text-base md:text-sm text-muted-foreground line-clamp-1">
                    {tour.description || 'No description'}
                  </p>
                  {config?.last_auto_backup_at && (
                    <p className="text-sm md:text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last backup: {new Date(config.last_auto_backup_at).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {isEnabled && (
                    <>
                      <Select
                        value={config?.backup_type || 'full_backup'}
                        onValueChange={(value) => handleChangeBackupType(tour.id, value as any)}
                      >
                        <SelectTrigger className="w-full sm:w-[140px] h-11 md:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_backup">
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4" />
                              Full Backup
                            </div>
                          </SelectItem>
                          <SelectItem value="media_only">
                            <div className="flex items-center gap-2">
                              <Cloud className="h-4 w-4" />
                              Media Only
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={config?.backup_frequency || 'immediate'}
                        onValueChange={(value) => handleChangeFrequency(tour.id, value as any)}
                      >
                        <SelectTrigger className="w-full sm:w-[130px] h-11 md:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled) => handleToggleAutoBackup(tour.id, enabled)}
                    className="scale-125 sm:scale-100"
                  />
                </div>
              </div>
            );
          })
        )}

        <div className="pt-4 border-t">
          <h4 className="text-base md:text-sm font-medium mb-2">ℹ️ Information</h4>
          <ul className="text-base md:text-sm text-muted-foreground space-y-1">
            <li>• <strong>Immediate:</strong> Backup happens every time you edit the tour</li>
            <li>• <strong>Daily:</strong> One backup per day (at 00:00)</li>
            <li>• <strong>Weekly:</strong> One backup per week</li>
            <li>• <strong>Full Backup:</strong> Includes data and media files</li>
            <li>• <strong>Media Only:</strong> Only photos and videos</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
