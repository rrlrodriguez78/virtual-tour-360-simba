import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Eye, Trash2, Share2, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TourTypeSelector } from "@/components/editor/TourTypeSelector";
import TourSetupModal from "@/components/editor/TourSetupModal";
import ShareTourDialog from "@/components/share/ShareTourDialog";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  cover_image_url?: string;
  tour_type: '360' | 'photos';
  created_at: string;
}

export default function DashboardAndroid() {
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Android-specific: Mobile header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Mis Tours</h1>
            <p className="text-xs text-muted-foreground">Versión Android</p>
          </div>
          <Badge variant="secondary">{tours.length} tours</Badge>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : tours.length === 0 ? (
          <Card className="p-8 text-center">
            <CardHeader>
              <CardTitle>No tienes tours</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Toca el botón + para crear uno
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Android-specific: Single column, compact cards */
          <div className="space-y-3">
            {tours.map((tour) => (
              <Card key={tour.id} className="overflow-hidden">
                {/* Android-specific: Horizontal layout */}
                <div className="flex gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg overflow-hidden">
                    {tour.cover_image_url ? (
                      <img
                        src={tour.cover_image_url}
                        alt={tour.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        Sin portada
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm line-clamp-1">{tour.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => togglePublishStatus(tour.id, tour.is_published)}>
                            {tour.is_published ? "Despublicar" : "Publicar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedTourForShare(tour);
                            setShareDialogOpen(true);
                          }}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Compartir
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              setTourToDelete(tour.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {tour.description || "Sin descripción"}
                    </p>

                    {/* Android-specific: Compact action buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          if (tour.tour_type === '360') {
                            navigate(`/app/editor/${tour.id}`);
                          } else {
                            navigate(`/app/photo-editor/${tour.id}`);
                          }
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/viewer/${tour.id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                    </div>

                    {/* Status badge */}
                    {tour.is_published && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Publicado
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Android-specific: FAB (Floating Action Button) */}
      <div className="fixed bottom-6 right-6 z-20">
        <Button
          onClick={() => setShowTypeSelector(true)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-2xl"
        >
          <Plus className="h-6 w-6" />
        </Button>
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
            <AlertDialogTitle>¿Eliminar tour?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTour}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
