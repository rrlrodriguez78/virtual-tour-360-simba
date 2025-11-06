import { usePlatformEditor } from '@/contexts/PlatformEditorContext';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, RotateCcw, Layout, Flag, AlertCircle } from 'lucide-react';
import { PlatformSelector } from './PlatformSelector';
import { LiveDualPreview } from './LiveDualPreview';
import { LayoutVisualEditor } from './LayoutVisualEditor';
import { FeatureFlagsEditor } from './FeatureFlagsEditor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export const GlobalPlatformEditor = () => {
  const {
    isEditorOpen,
    closeEditor,
    currentPlatform,
    setCurrentPlatform,
    currentPageName,
    tempLayoutConfig,
    setTempLayoutConfig,
    tempFeatureFlags,
    setTempFeatureFlags,
    saveChanges,
    revertChanges,
    isSaving,
    hasUnsavedChanges,
  } = usePlatformEditor();

  return (
    <Sheet open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <SheetContent side="right" className="w-full sm:max-w-[900px] overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">Platform Editor</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeEditor}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <SheetDescription className="text-left">
            Edita la configuración de <strong>{currentPageName}</strong> en tiempo real.
            Los cambios son independientes por plataforma.
          </SheetDescription>

          {/* Platform Selector */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Plataforma a Modificar:</div>
            <PlatformSelector
              value={currentPlatform}
              onChange={setCurrentPlatform}
            />
          </div>

          {hasUnsavedChanges && (
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/50">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600 dark:text-amber-400">
                Tienes cambios sin guardar en {currentPlatform === 'web' ? 'Web' : 'Android'}
              </AlertDescription>
            </Alert>
          )}
        </SheetHeader>

        <Separator className="my-6" />

        {/* Live Dual Preview */}
        <div className="mb-6">
          <LiveDualPreview
            pageName={currentPageName}
            layoutConfig={tempLayoutConfig}
            featureFlags={tempFeatureFlags}
            currentPlatform={currentPlatform}
          />
        </div>

        <Separator className="my-6" />

        {/* Editor Tabs */}
        <Tabs defaultValue="layout" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="layout" className="gap-2">
              <Layout className="h-4 w-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Flag className="h-4 w-4" />
              Features
            </TabsTrigger>
          </TabsList>

          <TabsContent value="layout" className="mt-4">
            <LayoutVisualEditor
              value={tempLayoutConfig}
              onChange={setTempLayoutConfig}
            />
          </TabsContent>

          <TabsContent value="features" className="mt-4">
            <FeatureFlagsEditor
              value={tempFeatureFlags}
              onChange={setTempFeatureFlags}
            />
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sticky bottom-0 bg-background py-4 border-t">
          <Button
            onClick={saveChanges}
            disabled={!hasUnsavedChanges || isSaving}
            className="flex-1 gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
          
          <Button
            variant="outline"
            onClick={revertChanges}
            disabled={!hasUnsavedChanges || isSaving}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Revertir
          </Button>
          
          <Button
            variant="ghost"
            onClick={closeEditor}
            disabled={isSaving}
          >
            Cerrar
          </Button>
        </div>

        {/* Platform Info */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Editando: <strong>{currentPlatform === 'web' ? 'Web Platform' : 'Android Platform'}</strong>
          {' '} • Página: <strong>{currentPageName}</strong>
        </div>
      </SheetContent>
    </Sheet>
  );
};
