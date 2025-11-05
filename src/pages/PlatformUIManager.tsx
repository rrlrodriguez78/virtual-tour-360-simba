import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlatformConfigList } from '@/components/platform-manager/PlatformConfigList';
import { PlatformConfigEditor } from '@/components/platform-manager/PlatformConfigEditor';
import { usePlatformUIConfigs, PlatformUIConfig } from '@/hooks/usePlatformUIManagement';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

export default function PlatformUIManager() {
  const navigate = useNavigate();
  const { data: configs, isLoading } = usePlatformUIConfigs();
  const { isSuperAdmin, loading: isLoadingAdmin } = useIsSuperAdmin();
  const [editingConfig, setEditingConfig] = useState<PlatformUIConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
              Solo los super administradores pueden acceder a esta página.
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/app/tours')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleEdit = (config: PlatformUIConfig) => {
    setEditingConfig(config);
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setEditingConfig(null);
    setIsCreating(true);
  };

  const handleClose = () => {
    setEditingConfig(null);
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/app/tours')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Dashboard
          </Button>
          
          <h1 className="text-4xl font-bold mb-2">
            Gestor de UI Multiplataforma
          </h1>
          <p className="text-muted-foreground text-lg">
            Controla cómo se ve cada página en Web y Android
          </p>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Sistema de UI Multiplataforma Fase 1 Activo:</strong> Puedes crear configuraciones
            para que las páginas se vean diferentes en Web vs Android. Define layouts personalizados,
            feature flags específicos, y componentes separados por plataforma.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : editingConfig || isCreating ? (
          <PlatformConfigEditor
            config={editingConfig || undefined}
            onClose={handleClose}
          />
        ) : (
          <PlatformConfigList
            configs={configs || []}
            onEdit={handleEdit}
            onCreateNew={handleCreateNew}
          />
        )}

        <div className="mt-8 p-6 bg-muted/50 rounded-lg border">
          <h3 className="font-semibold mb-3">💡 Cómo funciona:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><strong>1.</strong> Crea una configuración para una página específica (ej: "Dashboard")</li>
            <li><strong>2.</strong> Elige la plataforma: Web, Android, o Ambas</li>
            <li><strong>3.</strong> Define layout_config con clases de Tailwind por plataforma</li>
            <li><strong>4.</strong> Define feature_flags para activar/desactivar funcionalidades</li>
            <li><strong>5.</strong> (Opcional) Especifica un componente personalizado diferente</li>
            <li><strong>6.</strong> Activa la configuración y los usuarios verán la versión correcta automáticamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
