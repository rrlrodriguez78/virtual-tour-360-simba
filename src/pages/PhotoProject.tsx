import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, FolderOpen, Image as ImageIcon } from 'lucide-react';

export default function PhotoProject() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Photo Project</h1>
          <p className="text-muted-foreground">Gestiona y organiza tus proyectos fotográficos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Nuevo Proyecto</CardTitle>
              <CardDescription>Crea un nuevo proyecto fotográfico</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Organiza tus fotos en proyectos para mantener todo ordenado y accesible.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <FolderOpen className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Mis Proyectos</CardTitle>
              <CardDescription>Accede a tus proyectos existentes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualiza y gestiona todos tus proyectos fotográficos en un solo lugar.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-secondary-foreground" />
              </div>
              <CardTitle>Galería</CardTitle>
              <CardDescription>Explora tu colección de fotos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Navega por todas las fotos de tus diferentes proyectos.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
