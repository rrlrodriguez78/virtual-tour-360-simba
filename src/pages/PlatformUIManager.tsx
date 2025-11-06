import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InfoIcon, Settings, Plus, GitCompare, GitBranch } from 'lucide-react';
import { PlatformConfigList } from '@/components/platform-manager/PlatformConfigList';
import { PlatformConfigEditor } from '@/components/platform-manager/PlatformConfigEditor';
import { PlatformComparison } from '@/components/platform-manager/PlatformComparison';
import { VersionHistory } from '@/components/platform-manager/VersionHistory';
import { VersionComparison } from '@/components/platform-manager/VersionComparison';
import { usePlatformUIConfigs, PlatformUIConfig, useRollbackVersion } from '@/hooks/usePlatformUIManagement';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

export default function PlatformUIManager() {
  const { data: configs, isLoading, refetch } = usePlatformUIConfigs();
  const { isSuperAdmin, loading: isLoadingAdmin } = useIsSuperAdmin();
  const rollbackMutation = useRollbackVersion();
  const [editingConfig, setEditingConfig] = useState<PlatformUIConfig | null>(null);
  const [comparisonVersions, setComparisonVersions] = useState<{ v1: PlatformUIConfig; v2: PlatformUIConfig } | null>(null);

  const handleEdit = (config: PlatformUIConfig) => {
    setEditingConfig(config);
  };

  const handleRollback = async (pageName: string, version: number) => {
    const configToRollback = configs?.find(
      c => c.page_name === pageName && c.version === version
    );
    
    if (configToRollback) {
      await rollbackMutation.mutateAsync({
        id: configToRollback.id,
        rollbackToVersion: version
      });
      refetch();
    }
  };

  const handleCompare = (pageName: string, v1: number, v2: number) => {
    const version1 = configs?.find(c => c.page_name === pageName && c.version === v1);
    const version2 = configs?.find(c => c.page_name === pageName && c.version === v2);
    
    if (version1 && version2) {
      setComparisonVersions({ v1: version1, v2: version2 });
    }
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
        <div className="container mx-auto px-4 pt-24 pb-8">
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
      <div className="container mx-auto px-4 pt-24 pb-8 max-w-7xl">
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
            <strong>Phase 5 Active:</strong> Version management, rollback, comparison, and advanced feature flags now available.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="list" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurations
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Plus className="h-4 w-4" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Compare
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-2">
              <GitBranch className="h-4 w-4" />
              Versions
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

          <TabsContent value="versions" className="space-y-6">
            {Array.from(new Set(configs?.map(c => c.page_name))).map(pageName => {
              const pageConfigs = configs?.filter(c => c.page_name === pageName) || [];
              const currentVersion = pageConfigs.find(c => c.is_active)?.version;
              
              return (
                <Card key={pageName}>
                  <CardHeader>
                    <CardTitle>{pageName} - Version History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VersionHistory
                      configs={pageConfigs}
                      currentVersion={currentVersion}
                      onRollback={(version) => handleRollback(pageName, version)}
                      onCompare={(v1, v2) => handleCompare(pageName, v1, v2)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>

      {/* Version Comparison Dialog */}
      {comparisonVersions && (
        <Dialog open={!!comparisonVersions} onOpenChange={() => setComparisonVersions(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Version Comparison</DialogTitle>
            </DialogHeader>
            <VersionComparison
              version1={comparisonVersions.v1}
              version2={comparisonVersions.v2}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
