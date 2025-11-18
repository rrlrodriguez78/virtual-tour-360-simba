import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';
import { OfflineTourManager } from './OfflineTourManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SyncSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const SyncSettings = ({ settings, onUpdate }: SyncSettingsProps) => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="sync" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sync">Sincronización</TabsTrigger>
          <TabsTrigger value="offline">Trabajo Offline</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <CardTitle>Sync & Backup</CardTitle>
              </div>
              <CardDescription>Manage cloud synchronization and backup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cloud Sync</Label>
                  <p className="text-xs text-muted-foreground">
                    Sync your data across devices
                  </p>
                </div>
                <Switch
                  checked={settings.cloud_sync}
                  onCheckedChange={(checked) => onUpdate({ cloud_sync: checked })}
                />
              </div>

              <div>
                <Label htmlFor="backup_frequency">Backup Frequency</Label>
                <Select 
                  value={settings.backup_frequency} 
                  onValueChange={(value) => onUpdate({ backup_frequency: value as any })}
                >
                  <SelectTrigger id="backup_frequency" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Sync Data Types</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Tours</Label>
                    <Switch
                      checked={settings.sync_data_types.tours}
                      onCheckedChange={(checked) => 
                        onUpdate({ 
                          sync_data_types: { ...settings.sync_data_types, tours: checked } 
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Media</Label>
                    <Switch
                      checked={settings.sync_data_types.media}
                      onCheckedChange={(checked) => 
                        onUpdate({ 
                          sync_data_types: { ...settings.sync_data_types, media: checked } 
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Settings</Label>
                    <Switch
                      checked={settings.sync_data_types.settings}
                      onCheckedChange={(checked) => 
                        onUpdate({ 
                          sync_data_types: { ...settings.sync_data_types, settings: checked } 
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cross-Device Sync</Label>
                  <p className="text-xs text-muted-foreground">
                    Keep settings in sync across all devices
                  </p>
                </div>
                <Switch
                  checked={settings.cross_device_sync}
                  onCheckedChange={(checked) => onUpdate({ cross_device_sync: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offline">
          <OfflineTourManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
