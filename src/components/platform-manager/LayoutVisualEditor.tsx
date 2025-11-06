import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LayoutConfig {
  columns?: number;
  gap?: string;
  padding?: string;
  cardSize?: 'sm' | 'md' | 'lg';
  showSidebar?: boolean;
  sidebarPosition?: 'left' | 'right';
  headerStyle?: 'compact' | 'normal' | 'extended';
  navigationStyle?: 'tabs' | 'pills' | 'underline';
  spacing?: 'tight' | 'normal' | 'relaxed';
  [key: string]: any;
}

interface LayoutVisualEditorProps {
  value: LayoutConfig;
  onChange: (config: LayoutConfig) => void;
}

export const LayoutVisualEditor = ({ value, onChange }: LayoutVisualEditorProps) => {
  const [config, setConfig] = useState<LayoutConfig>(value || {});

  useEffect(() => {
    onChange(config);
  }, [config]);

  const updateConfig = (key: string, val: any) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="spacing">Spacing</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Grid Layout</CardTitle>
              <CardDescription>Configure the main grid structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="columns">Columns</Label>
                  <Input
                    id="columns"
                    type="number"
                    min="1"
                    max="6"
                    value={config.columns || 3}
                    onChange={(e) => updateConfig('columns', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gap">Gap</Label>
                  <Select
                    value={config.gap || 'md'}
                    onValueChange={(val) => updateConfig('gap', val)}
                  >
                    <SelectTrigger id="gap">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Small (0.5rem)</SelectItem>
                      <SelectItem value="md">Medium (1rem)</SelectItem>
                      <SelectItem value="lg">Large (1.5rem)</SelectItem>
                      <SelectItem value="xl">Extra Large (2rem)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sidebar">Show Sidebar</Label>
                  <p className="text-sm text-muted-foreground">
                    Display a sidebar navigation
                  </p>
                </div>
                <Switch
                  id="sidebar"
                  checked={config.showSidebar || false}
                  onCheckedChange={(checked) => updateConfig('showSidebar', checked)}
                />
              </div>

              {config.showSidebar && (
                <div className="space-y-2">
                  <Label htmlFor="sidebarPos">Sidebar Position</Label>
                  <Select
                    value={config.sidebarPosition || 'left'}
                    onValueChange={(val) => updateConfig('sidebarPosition', val)}
                  >
                    <SelectTrigger id="sidebarPos">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spacing" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Spacing & Padding</CardTitle>
              <CardDescription>Adjust spacing and padding values</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="padding">Container Padding</Label>
                <Select
                  value={config.padding || 'md'}
                  onValueChange={(val) => updateConfig('padding', val)}
                >
                  <SelectTrigger id="padding">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="sm">Small (0.5rem)</SelectItem>
                    <SelectItem value="md">Medium (1rem)</SelectItem>
                    <SelectItem value="lg">Large (1.5rem)</SelectItem>
                    <SelectItem value="xl">Extra Large (2rem)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="spacing">Overall Spacing</Label>
                <Select
                  value={config.spacing || 'normal'}
                  onValueChange={(val) => updateConfig('spacing', val)}
                >
                  <SelectTrigger id="spacing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tight">Tight (Dense layout)</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="relaxed">Relaxed (Spacious)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Component Styles</CardTitle>
              <CardDescription>Configure component appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardSize">Card Size</Label>
                <Select
                  value={config.cardSize || 'md'}
                  onValueChange={(val) => updateConfig('cardSize', val)}
                >
                  <SelectTrigger id="cardSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headerStyle">Header Style</Label>
                <Select
                  value={config.headerStyle || 'normal'}
                  onValueChange={(val) => updateConfig('headerStyle', val)}
                >
                  <SelectTrigger id="headerStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="extended">Extended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="navStyle">Navigation Style</Label>
                <Select
                  value={config.navigationStyle || 'tabs'}
                  onValueChange={(val) => updateConfig('navigationStyle', val)}
                >
                  <SelectTrigger id="navStyle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tabs">Tabs</SelectItem>
                    <SelectItem value="pills">Pills</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
