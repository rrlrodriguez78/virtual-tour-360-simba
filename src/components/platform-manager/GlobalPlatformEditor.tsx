import { usePlatformEditor } from '@/contexts/PlatformEditorContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlatformSelector } from './PlatformSelector';
import { X, MessageSquare, Sparkles } from 'lucide-react';

export const GlobalPlatformEditor = () => {
  const {
    isEditorOpen,
    closeEditor,
    currentPlatform,
    setCurrentPlatform,
    currentPageName,
  } = usePlatformEditor();

  const getPlatformLabel = () => {
    switch (currentPlatform) {
      case 'web':
        return 'Web Desktop 🔵';
      case 'android':
        return 'Android Mobile 🟢';
      case 'both':
        return 'Ambos Sistemas 🟣';
    }
  };

  return (
    <Sheet open={isEditorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <SheetContent side="right" className="w-full sm:max-w-[500px]">
        <SheetHeader className="space-y-6">
          {/* Header */}
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

          {/* Página actual */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Editando:</span>
            <Badge variant="outline" className="font-mono">
              {currentPageName}
            </Badge>
          </div>

          {/* Instrucciones */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
              <Sparkles className="h-4 w-4" />
              Modo de Comandos por IA
            </div>
            <p className="text-sm text-muted-foreground">
              Selecciona la plataforma que deseas modificar y escribe tus comandos en el chat. 
              La IA aplicará los cambios automáticamente según el contexto seleccionado.
            </p>
          </div>

          {/* Platform Selector - LO ÚNICO FUNCIONAL */}
          <div className="space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Contexto Activo para Comandos:
            </div>
            <PlatformSelector
              value={currentPlatform}
              onChange={setCurrentPlatform}
            />
          </div>

          {/* Indicador visual del estado actual */}
          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              Plataforma Seleccionada
            </div>
            <div className="text-lg font-bold">
              {getPlatformLabel()}
            </div>
            <div className="text-xs text-muted-foreground">
              Todos los comandos que des en el chat se aplicarán a esta plataforma
            </div>
          </div>

          {/* Ejemplo de uso */}
          <div className="bg-muted/30 border rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              💡 Ejemplo de uso:
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• Selecciona <strong>Web 🔵</strong></div>
              <div>• Escribe: "Agrega un botón azul en el header"</div>
              <div>• La IA aplicará el cambio solo a Web</div>
            </div>
          </div>

          {/* Botón de cerrar al final */}
          <Button
            variant="outline"
            onClick={closeEditor}
            className="w-full"
          >
            Cerrar Editor
          </Button>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};
