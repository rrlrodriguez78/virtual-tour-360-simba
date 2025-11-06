import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Eye, Trash2, Upload, Lock, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TourTypeSelector } from "@/components/editor/TourTypeSelector";
import TourSetupModal from "@/components/editor/TourSetupModal";
import { TourPasswordDialog } from "@/components/editor/TourPasswordDialog";
import ShareTourDialog from "@/components/share/ShareTourDialog";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/Navbar";

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  cover_image_url?: string;
  tour_type: '360' | 'photos';
  created_at: string;
}

export default function DashboardWeb() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tourToDelete, setTourToDelete] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'360' | 'photos'>('360');
  const [isSaving, setIsSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedTourForPassword, setSelectedTourForPassword] = useState<Tour | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedTourForShare, setSelectedTourForShare] = useState<Tour | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && currentTenant) {
      loadData();
    }
  }, [user, currentTenant]);

  const loadData = async () => {
    if (!currentTenant) return;

    try {
      setLoading(true);
      const { data: toursData, error: toursError } = await supabase
        .from("virtual_tours")
        .select("id, title, description, is_published, cover_image_url, tour_type, created_at")
        .eq("tenant_id", currentTenant.tenant_id)
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .order("created_at", { ascending: false });

      if (toursError) throw toursError;
      setTours((toursData || []) as Tour[]);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTourTypeSelect = (type: '360' | 'photos') => {
    setSelectedType(type);
    setShowTypeSelector(false);
    setShowSetupModal(true);
  };

  const handleCreateTour = async (tourData: { title: string; description: string; coverImageUrl?: string }) => {
    if (!user || !currentTenant) return;

    setIsSaving(true);
    try {
      const { data: newTour, error } = await supabase
        .from("virtual_tours")
        .insert([
          {
            title: tourData.title,
            description: tourData.description,
            cover_image_url: tourData.coverImageUrl,
            user_id: user.id,
            tenant_id: currentTenant.tenant_id,
            tour_type: selectedType,
            is_published: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tour creado",
        description: "El tour se ha creado exitosamente",
      });

      setShowSetupModal(false);
      
      if (selectedType === '360') {
        navigate(`/app/editor/${newTour.id}`);
      } else {
        navigate(`/app/photo-editor/${newTour.id}`);
      }
    } catch (error: any) {
      console.error("Error creating tour:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadCover = async (tourId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${tourId}/cover.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tour-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-assets')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('virtual_tours')
        .update({ cover_image_url: publicUrl })
        .eq('id', tourId);

      if (updateError) throw updateError;

      toast({
        title: "Portada actualizada",
        description: "La imagen de portada se ha actualizado correctamente",
      });

      loadData();
    } catch (error: any) {
      console.error("Error uploading cover:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTour = async () => {
    if (!tourToDelete) return;

    try {
      const { error } = await supabase
        .from("virtual_tours")
        .delete()
        .eq("id", tourToDelete);

      if (error) throw error;

      toast({
        title: "Tour eliminado",
        description: "El tour se ha eliminado correctamente",
      });

      loadData();
    } catch (error: any) {
      console.error("Error deleting tour:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTourToDelete(null);
    }
  };

  const togglePublishStatus = async (tourId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("virtual_tours")
        .update({ is_published: !currentStatus })
        .eq("id", tourId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Tour despublicado" : "Tour publicado",
        description: currentStatus 
          ? "El tour ya no es visible públicamente" 
          : "El tour ahora es visible en la galería pública",
      });

      loadData();
    } catch (error: any) {
      console.error("Error toggling publish status:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user || !currentTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>
              Debes iniciar sesión para acceder a esta página
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Web-specific: Advanced header with stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Mis Tours Virtuales
              </h1>
              <p className="text-muted-foreground mt-2">
                Versión Web - Diseño de escritorio optimizado
              </p>
            </div>
            <Button
              onClick={() => setShowTypeSelector(true)}
              size="lg"
              className="shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="mr-2 h-5 w-5" />
              Crear Nuevo Tour
            </Button>
          </div>
          
          {/* Web-specific: Stats cards */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{tours.length}</div>
                <p className="text-sm text-muted-foreground">Total Tours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{tours.filter(t => t.is_published).length}</div>
                <p className="text-sm text-muted-foreground">Publicados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{tours.filter(t => t.tour_type === '360').length}</div>
                <p className="text-sm text-muted-foreground">Tours 360°</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : tours.length === 0 ? (
          <Card className="p-12 text-center">
            <CardHeader>
              <CardTitle>No tienes tours todavía</CardTitle>
              <CardDescription>
                Comienza creando tu primer tour virtual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowTypeSelector(true)} size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Crear Mi Primer Tour
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Web-specific: 3-column grid layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tours.map((tour) => (
              <Card key={tour.id} className="group hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg overflow-hidden mb-4">
                    {tour.cover_image_url ? (
                      <img
                        src={tour.cover_image_url}
                        alt={tour.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground">Sin portada</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadCover(tour.id, file);
                          }}
                        />
                        <Button variant="secondary" size="sm" asChild>
                          <span>
                            <Upload className="h-4 w-4" />
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  <CardTitle className="line-clamp-1">{tour.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {tour.description || "Sin descripción"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Web-specific: Horizontal button layout */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        if (tour.tour_type === '360') {
                          navigate(`/app/editor/${tour.id}`);
                        } else {
                          navigate(`/app/photo-editor/${tour.id}`);
                        }
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/viewer/${tour.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant={tour.is_published ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => togglePublishStatus(tour.id, tour.is_published)}
                    >
                      {tour.is_published ? "Despublicar" : "Publicar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTourForPassword(tour);
                        setPasswordDialogOpen(true);
                      }}
                    >
                      <Lock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTourForShare(tour);
                        setShareDialogOpen(true);
                      }}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setTourToDelete(tour.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TourTypeSelector
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelect={handleTourTypeSelect}
      />

      <TourSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onConfirm={handleCreateTour}
        isSaving={isSaving}
        tourType={selectedType}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el tour permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTour}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTourForPassword && (
        <TourPasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          tourId={selectedTourForPassword.id}
          isProtected={false}
          onSuccess={loadData}
        />
      )}

      {selectedTourForShare && (
        <ShareTourDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          tourId={selectedTourForShare.id}
          tourTitle={selectedTourForShare.title}
        />
      )}
    </div>
  );
}
