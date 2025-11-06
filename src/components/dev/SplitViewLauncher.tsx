import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Columns } from 'lucide-react';
import { useSplitView } from '@/contexts/SplitViewContext';

export const SplitViewLauncher = () => {
  const { isWindowOpen, openSplitView } = useSplitView();

  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Vista Dividida</Label>
        {isWindowOpen && (
          <Badge variant="secondary" className="text-xs">
            Ventana abierta
          </Badge>
        )}
      </div>
      
      <Button
        onClick={openSplitView}
        disabled={isWindowOpen}
        variant={isWindowOpen ? "secondary" : "default"}
        size="sm"
        className="w-full gap-2"
      >
        <Columns className="w-4 h-4" />
        {isWindowOpen ? 'Ventana Activa' : 'Abrir Vista Dividida'}
      </Button>

      {isWindowOpen && (
        <p className="text-xs text-muted-foreground">
          La vista dividida se abrió en una ventana separada
        </p>
      )}
    </div>
  );
};
