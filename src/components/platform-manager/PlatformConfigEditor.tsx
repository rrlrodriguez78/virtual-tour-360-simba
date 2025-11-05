import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Code2, Palette, ToggleLeft } from 'lucide-react';
import { PlatformUIConfig, useCreatePlatformUIConfig, useUpdatePlatformUIConfig } from '@/hooks/usePlatformUIManagement';

interface PlatformConfigEditorProps {
  config?: PlatformUIConfig;
  onClose: () => void;
}

export function PlatformConfigEditor({ config, onClose }: PlatformConfigEditorProps) {
  const createConfig = useCreatePlatformUIConfig();
  const updateConfig = useUpdatePlatformUIConfig();

  const [formData, setFormData] = useState<{
    page_name: string;
    platform: 'web' | 'android' | 'both';
    is_active: boolean;
    component_path: string;
    layout_config: string;
    feature_flags: string;
  }>({
    page_name: config?.page_name || '',
    platform: config?.platform || 'web',
    is_active: config?.is_active ?? true,
    component_path: config?.component_path || '',
    layout_config: JSON.stringify(config?.layout_config || {}, null, 2),
    feature_flags: JSON.stringify(config?.feature_flags || {}, null, 2),
  });

  const isEdit = !!config;

  const handleSave = async () => {
    try {
      const layoutConfig = JSON.parse(formData.layout_config);
      const featureFlags = JSON.parse(formData.feature_flags);

      if (!['web', 'android', 'both'].includes(formData.platform)) {
        throw new Error('Plataforma inválida');
      }

      const data = {
        page_name: formData.page_name,
        platform: formData.platform as 'web' | 'android' | 'both',
        is_active: formData.is_active,
        component_path: formData.component_path,
        layout_config: layoutConfig,
        feature_flags: featureFlags,
      };

      if (isEdit) {
        await updateConfig.mutateAsync({
          id: config.id,
          updates: data,
        });
      } else {
        await createConfig.mutateAsync(data);
      }

      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            {isEdit ? 'Editar' : 'Nueva'} Configuración
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEdit ? 'Modifica la configuración existente' : 'Crea una nueva configuración de plataforma'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="page_name">Nombre de Página</Label>
            <Input
              id="page_name"
              placeholder="Dashboard, Viewer, Editor..."
              value={formData.page_name}
              onChange={(e) => setFormData({ ...formData, page_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform">Plataforma</Label>
            <Select
              value={formData.platform}
              onValueChange={(value: 'web' | 'android' | 'both') => setFormData({ ...formData, platform: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="android">Android</SelectItem>
                <SelectItem value="both">Ambas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="component_path">Ruta del Componente (opcional)</Label>
          <Input
            id="component_path"
            placeholder="pages/Dashboard.android.tsx"
            value={formData.component_path}
            onChange={(e) => setFormData({ ...formData, component_path: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">
            Deja vacío para usar el componente por defecto
          </p>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <Label htmlFor="is_active">Estado Activo</Label>
            <p className="text-sm text-muted-foreground">
              Activa o desactiva esta configuración
            </p>
          </div>
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
        </div>

        <Tabs defaultValue="layout" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="layout" className="gap-2">
              <Palette className="h-4 w-4" />
              Layout Config
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <ToggleLeft className="h-4 w-4" />
              Feature Flags
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layout" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="layout_config">Configuración de Layout (JSON)</Label>
              <Textarea
                id="layout_config"
                placeholder='{\n  "web": {\n    "container": "max-w-7xl",\n    "grid": "grid-cols-3"\n  },\n  "android": {\n    "container": "px-2",\n    "grid": "grid-cols-1"\n  }\n}'
                value={formData.layout_config}
                onChange={(e) => setFormData({ ...formData, layout_config: e.target.value })}
                className="font-mono text-sm min-h-[200px]"
              />
              <p className="text-sm text-muted-foreground">
                Define clases de Tailwind específicas por plataforma
              </p>
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feature_flags">Feature Flags (JSON)</Label>
              <Textarea
                id="feature_flags"
                placeholder='{\n  "web": {\n    "bulkActions": true,\n    "advancedFilters": true\n  },\n  "android": {\n    "swipeGestures": true,\n    "quickActions": true\n  }\n}'
                value={formData.feature_flags}
                onChange={(e) => setFormData({ ...formData, feature_flags: e.target.value })}
                className="font-mono text-sm min-h-[200px]"
              />
              <p className="text-sm text-muted-foreground">
                Define funcionalidades específicas por plataforma
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={createConfig.isPending || updateConfig.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isEdit ? 'Guardar Cambios' : 'Crear Configuración'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Card>
  );
}
