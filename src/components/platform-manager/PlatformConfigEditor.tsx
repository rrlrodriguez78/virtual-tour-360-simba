import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreatePlatformUIConfig, useUpdatePlatformUIConfig } from '@/hooks/usePlatformUIManagement';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { LayoutVisualEditor } from './LayoutVisualEditor';
import { FeatureFlagsEditor } from './FeatureFlagsEditor';
import { PlatformPreview } from './PlatformPreview';

type PlatformUIConfig = Database['public']['Tables']['platform_ui_config']['Row'];

interface PlatformConfigEditorProps {
  config?: PlatformUIConfig;
  onSave?: () => void;
  onCancel?: () => void;
}

export const PlatformConfigEditor = ({ config, onSave, onCancel }: PlatformConfigEditorProps) => {
  const createMutation = useCreatePlatformUIConfig();
  const updateMutation = useUpdatePlatformUIConfig();
  const isEditing = !!config;

  const [formData, setFormData] = useState({
    page_name: config?.page_name || '',
    platform: config?.platform || ('web' as 'web' | 'android' | 'ios' | 'both'),
    component_path: config?.component_path || '',
    is_active: config?.is_active ?? true,
    layout_config: config?.layout_config || {},
    feature_flags: config?.feature_flags || {},
  });

  const [layoutConfigText, setLayoutConfigText] = useState(
    JSON.stringify(config?.layout_config || {}, null, 2)
  );
  const [featureFlagsText, setFeatureFlagsText] = useState(
    JSON.stringify(config?.feature_flags || {}, null, 2)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Parse JSON from text areas if in JSON tab
      let layoutConfig = formData.layout_config;
      let featureFlags = formData.feature_flags;

      try {
        const parsedLayout = JSON.parse(layoutConfigText);
        const parsedFlags = JSON.parse(featureFlagsText);
        layoutConfig = parsedLayout;
        featureFlags = parsedFlags;
      } catch (parseError) {
        // Use the visual editor values if JSON parsing fails
      }

      const data = {
        page_name: formData.page_name,
        platform: formData.platform as 'web' | 'android' | 'both',
        component_path: formData.component_path || null,
        is_active: formData.is_active,
        layout_config: layoutConfig as any,
        feature_flags: featureFlags as any,
      };

      if (isEditing && config) {
        await updateMutation.mutateAsync({
          id: config.id,
          updates: data as any,
        });
        toast.success('Configuration updated successfully');
      } else {
        await createMutation.mutateAsync(data as any);
        toast.success('Configuration created successfully');
      }

      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit' : 'Create'} Platform Configuration</CardTitle>
          <CardDescription>
            Configure UI settings for specific platforms with visual editor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="page_name">Page Name</Label>
                <Input
                  id="page_name"
                  value={formData.page_name}
                  onChange={(e) => setFormData({ ...formData, page_name: e.target.value })}
                  placeholder="Dashboard"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value) => setFormData({ ...formData, platform: value as 'web' | 'android' | 'ios' | 'both' })}
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="android">Android</SelectItem>
                    <SelectItem value="ios">iOS</SelectItem>
                    <SelectItem value="both">Both (Mobile)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="component_path">Component Path</Label>
              <Input
                id="component_path"
                value={formData.component_path}
                onChange={(e) => setFormData({ ...formData, component_path: e.target.value })}
                placeholder="pages/Dashboard"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Relative path without extension (e.g., "pages/Dashboard")
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active Configuration</Label>
            </div>

            <Tabs defaultValue="visual" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="visual">Visual Editor</TabsTrigger>
                <TabsTrigger value="flags">Feature Flags</TabsTrigger>
                <TabsTrigger value="json">JSON (Advanced)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="visual" className="mt-4">
                <LayoutVisualEditor
                  value={(formData.layout_config as any) || {}}
                  onChange={(config) => {
                    setFormData({ ...formData, layout_config: config as any });
                    setLayoutConfigText(JSON.stringify(config, null, 2));
                  }}
                />
              </TabsContent>

              <TabsContent value="flags" className="mt-4">
                <FeatureFlagsEditor
                  value={(formData.feature_flags as any) || {}}
                  onChange={(flags) => {
                    setFormData({ ...formData, feature_flags: flags as any });
                    setFeatureFlagsText(JSON.stringify(flags, null, 2));
                  }}
                />
              </TabsContent>

              <TabsContent value="json" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="layout_config">Layout Configuration (JSON)</Label>
                  <textarea
                    id="layout_config"
                    value={layoutConfigText}
                    onChange={(e) => setLayoutConfigText(e.target.value)}
                    placeholder='{ "columns": 3, "gap": "md" }'
                    className="w-full font-mono text-sm min-h-[150px] p-2 border rounded-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feature_flags">Feature Flags (JSON)</Label>
                  <textarea
                    id="feature_flags"
                    value={featureFlagsText}
                    onChange={(e) => setFeatureFlagsText(e.target.value)}
                    placeholder='{ "showAnalytics": true }'
                    className="w-full font-mono text-sm min-h-[150px] p-2 border rounded-md"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Configuration'}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <PlatformPreview
        pageName={formData.page_name}
        layoutConfig={formData.layout_config}
        featureFlags={formData.feature_flags}
      />
    </div>
  );
};
