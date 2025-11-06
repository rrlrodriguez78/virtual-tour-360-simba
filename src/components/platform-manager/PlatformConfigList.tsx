import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Monitor, Smartphone, Globe, Settings, Trash2, Plus, History } from 'lucide-react';
import { PlatformUIConfig, useUpdatePlatformUIConfig, useDeletePlatformUIConfig } from '@/hooks/usePlatformUIManagement';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PlatformConfigListProps {
  configs: PlatformUIConfig[];
  onEdit: (config: PlatformUIConfig) => void;
  onCreateNew: () => void;
}

export function PlatformConfigList({ configs, onEdit, onCreateNew }: PlatformConfigListProps) {
  const updateConfig = useUpdatePlatformUIConfig();
  const deleteConfig = useDeletePlatformUIConfig();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'web':
        return <Monitor className="h-4 w-4" />;
      case 'android':
        return <Smartphone className="h-4 w-4" />;
      case 'both':
        return <Globe className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'web':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'android':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'both':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return '';
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.page_name]) {
      acc[config.page_name] = [];
    }
    acc[config.page_name].push(config);
    return acc;
  }, {} as Record<string, PlatformUIConfig[]>);

  const handleToggleActive = async (id: string, currentState: boolean) => {
    await updateConfig.mutateAsync({
      id,
      updates: { is_active: !currentState },
    });
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteConfig.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Configuraciones de Plataforma</h2>
            <p className="text-muted-foreground mt-1">
              Gestiona cómo se ve cada página en diferentes plataformas
            </p>
          </div>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Configuración
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Página</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Componente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Versión</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedConfigs).map(([pageName, pageConfigs]) =>
              pageConfigs.map((config, idx) => (
                <TableRow key={config.id}>
                  {idx === 0 && (
                    <TableCell rowSpan={pageConfigs.length} className="font-medium">
                      {pageName}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1.5 ${getPlatformColor(config.platform)}`}
                    >
                      {getPlatformIcon(config.platform)}
                      {config.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {config.component_path || 'Por defecto'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={() => handleToggleActive(config.id, config.is_active)}
                        disabled={updateConfig.isPending}
                      />
                      <span className="text-sm">
                        {config.is_active ? (
                          <span className="text-green-600">Activo</span>
                        ) : (
                          <span className="text-muted-foreground">Inactivo</span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    v{config.version}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(config)}
                        className="gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(config.id)}
                        className="gap-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay configuraciones. Crea una para empezar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la configuración de plataforma.
              No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
