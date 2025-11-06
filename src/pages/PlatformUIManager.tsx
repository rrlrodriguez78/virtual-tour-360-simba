import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InfoIcon, Monitor, Smartphone, GitCompare } from 'lucide-react';
import { PlatformConfigList } from '@/components/platform-manager/PlatformConfigList';
import { PlatformConfigEditor } from '@/components/platform-manager/PlatformConfigEditor';
import { PlatformComparison } from '@/components/platform-manager/PlatformComparison';
import { usePlatformUIConfigs, PlatformUIConfig } from '@/hooks/usePlatformUIManagement';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

export default function PlatformUIManager() {
  const { data: configs, isLoading, refetch } = usePlatformUIConfigs();
  const { isSuperAdmin, loading: isLoadingAdmin } = useIsSuperAdmin();
  const [editingConfig, setEditingConfig] = useState<PlatformUIConfig | null>(null);

  const handleEdit = (config: PlatformUIConfig) => {
    setEditingConfig(config);
  };

  if (isLoadingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertDescription>
              Only super admins can access this page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Platform UI Manager
          </h1>
          <p className="text-muted-foreground text-lg">
            Configure how each page looks on Web and Android with advanced visual editor
          </p>
        </div>

        <Alert className="mb-6">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Phase 4 Active:</strong> Visual editors, feature flag toggles, live preview, and platform comparison now available.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">
              <Monitor className="h-4 w-4 mr-2" />
              Configurations
            </TabsTrigger>
            <TabsTrigger value="create">
              <Smartphone className="h-4 w-4 mr-2" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="compare">
              <GitCompare className="h-4 w-4 mr-2" />
              Compare
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            {editingConfig && (
              <div className="mb-6">
                <PlatformConfigEditor
                  config={editingConfig}
                  onSave={() => {
                    setEditingConfig(null);
                    refetch();
                  }}
                  onCancel={() => setEditingConfig(null)}
                />
              </div>
            )}
            
            {!editingConfig && (
              <PlatformConfigList
                configs={configs || []}
                onEdit={handleEdit}
                onCreateNew={() => {}}
              />
            )}
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <PlatformConfigEditor
              onSave={() => {
                refetch();
              }}
            />
          </TabsContent>

          <TabsContent value="compare" className="mt-6">
            <div className="space-y-6">
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Compare configurations across different platforms to see differences in features and layout.
                </AlertDescription>
              </Alert>

              {Array.from(new Set(configs?.map(c => c.page_name))).map(pageName => (
                <PlatformComparison key={pageName} pageName={pageName} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
