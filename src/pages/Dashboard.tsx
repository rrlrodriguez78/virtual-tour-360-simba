import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Eye, Edit, Trash2, Globe, Lock, Upload, Image as ImageIcon, Shield, Share2 } from 'lucide-react';
import ShareTourDialog from '@/components/share/ShareTourDialog';
import TourSetupModal from '@/components/editor/TourSetupModal';
import { TourTypeSelector } from '@/components/editor/TourTypeSelector';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TourPasswordDialog } from '@/components/editor/TourPasswordDialog';

interface Organization {
  id: string;
  name: string;
}

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  created_at: string;
  cover_image_url?: string;
  password_protected?: boolean;
  tour_type?: 'tour_360' | 'photo_tour';
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { t } = useTranslation();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTourType, setSelectedTourType] = useState<'360' | 'photos' | null>(null);
  const [savingTour, setSavingTour] = useState(false);
  const [uploadingCover, setUploadingCover] = useState<string | null>(null);
  const [tourToDelete, setTourToDelete] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedTourForPassword, setSelectedTourForPassword] = useState<Tour | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedTourForShare, setSelectedTourForShare] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && currentTenant) {
      loadData();
    }
  }, [user, currentTenant]);

  const loadData = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      // Load tours - EXCLUDE the "115N 3ST" tour (reserved for CreateTour page)
      const toursData: Tour[] = (await supabase
        .from('virtual_tours')
        .select('*')
        .eq('tenant_id', currentTenant.tenant_id)
        .neq('id', 'a5f2a965-d194-4f27-a01f-a0981f0ae307')
        .order('created_at', { ascending: false })).data as Tour[];

      if (toursData) {
        setTours(toursData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(t('dashboard.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleTourTypeSelect = (type: '360' | 'photos') => {
    setSelectedTourType(type);
    setModalOpen(true);
  };

  const handleCreateTour = async (tourData: { title: string; description: string; coverImageUrl?: string }) => {
    if (!currentTenant) {
      toast.error(t('dashboard.organizationNotFound'));
      return;
    }

    setSavingTour(true);
    try {
      const { data, error } = await supabase
        .from('virtual_tours')
        .insert({
          title: tourData.title,
          description: tourData.description,
          tenant_id: currentTenant.tenant_id,
          cover_image_url: tourData.coverImageUrl,
          tour_type: selectedTourType === '360' ? 'tour_360' : 'photo_tour',
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success(t('dashboard.tourCreated'));
      setTours([data as Tour, ...tours]);
      setModalOpen(false);
      
      // Navigate to correct editor based on tour type
      const editorPath = data.tour_type === 'photo_tour' 
        ? `/app/photo-editor/${data.id}` 
        : `/app/editor/${data.id}`;
      navigate(editorPath);
    } catch (error) {
      console.error('Error creating tour:', error);
      toast.error(t('dashboard.errorCreating'));
    } finally {
      setSavingTour(false);
    }
  };

  const handleUploadCover = async (tourId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingCover(tourId);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${tourId}/cover-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('virtual_tours')
          .update({ cover_image_url: publicUrl })
          .eq('id', tourId);

        if (updateError) throw updateError;

        setTours(tours.map(t => 
          t.id === tourId ? { ...t, cover_image_url: publicUrl } : t
        ));
        toast.success(t('dashboard.coverUploaded'));
      } catch (error) {
        console.error('Error uploading cover:', error);
        toast.error(t('dashboard.errorUploadingCover'));
      } finally {
        setUploadingCover(null);
      }
    };

    input.click();
  };

  const deleteTour = async (id: string) => {
    try {
      const { error } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(t('dashboard.tourDeleted'));
      setTours(tours.filter(t => t.id !== id));
      setTourToDelete(null);
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error(t('dashboard.errorDeleting'));
    }
  };

  const togglePublishStatus = async (tourId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase
        .from('virtual_tours')
        .update({ is_published: newStatus })
        .eq('id', tourId);

      if (error) throw error;

      setTours(tours.map(t => 
        t.id === tourId ? { ...t, is_published: newStatus } : t
      ));
      
      toast.success(newStatus ? t('dashboard.tourPublished') : t('dashboard.tourUnpublished'));
    } catch (error) {
      console.error('Error toggling publish status:', error);
      toast.error(t('dashboard.errorChangingStatus'));
    }
  };

  if (authLoading || loading || tenantLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentTenant && !tenantLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Card className="p-12 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">{t('dashboard.noAccess')}</CardTitle>
              <CardDescription>
                {t('dashboard.noAccessDescription')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <Button size="lg" onClick={() => setTypeSelectorOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            {t('dashboard.createNew')}
          </Button>
          
          <TourTypeSelector
            isOpen={typeSelectorOpen}
            onClose={() => setTypeSelectorOpen(false)}
            onSelect={handleTourTypeSelect}
          />
          
          <TourSetupModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setSelectedTourType(null);
            }}
            onConfirm={handleCreateTour}
            isSaving={savingTour}
            tourType={selectedTourType}
          />
        </div>

        {tours.length === 0 ? (
          <Card className="p-12 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">{t('dashboard.noTours')}</CardTitle>
              <CardDescription>
                {t('dashboard.noToursDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setTypeSelectorOpen(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                {t('dashboard.createFirstTour')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tours.map((tour) => (
              <Card key={tour.id} className="p-0 hover:shadow-lg transition-all overflow-hidden">
                <div className="relative h-32 bg-muted overflow-hidden">
                  {tour.cover_image_url ? (
                    <>
                      <div 
                        onClick={() => navigate(`/viewer/${tour.id}`)}
                        className="cursor-pointer group w-full h-full"
                      >
                        <img 
                          src={tour.cover_image_url} 
                          alt={tour.title}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Eye className="w-12 h-12 text-white drop-shadow-lg" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">{t('dashboard.noDescription')}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Title and Status Overlay - Top */}
                  <div className="absolute top-1.5 left-1.5 right-1.5 z-10 flex justify-between items-start gap-2">
                    <div className="backdrop-blur-sm bg-black/40 px-2 py-1 rounded border border-white/20 flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-xs truncate">{tour.title}</h3>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => togglePublishStatus(tour.id, tour.is_published)}
                            className="backdrop-blur-sm bg-black/40 px-1.5 py-1 rounded border border-white/20 flex items-center justify-center shrink-0 hover:bg-black/60 transition-all cursor-pointer"
                          >
                            {tour.is_published ? (
                              <Globe className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-gray-300" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{tour.is_published ? t('dashboard.published') : t('dashboard.notPublished')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {/* Action Buttons - Bottom Left */}
                  <div className="absolute bottom-1.5 left-1.5 flex gap-1.5 z-10">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const editorPath = tour.tour_type === 'photo_tour' 
                                ? `/app/photo-editor/${tour.id}` 
                                : `/app/editor/${tour.id}`;
                              navigate(editorPath);
                            }}
                            className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('dashboard.edit')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setTourToDelete(tour.id)}
                            className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-red-600/60 transition-all border border-white/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('dashboard.delete')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/viewer/${tour.id}`)}
                            className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-blue-600/60 transition-all border border-white/20"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{tour.is_published ? t('dashboard.view') : t('dashboard.preview')}</p>
                        </TooltipContent>
                      </Tooltip>
                     </TooltipProvider>
                    
                    {tour.is_published && (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedTourForPassword(tour);
                                  setPasswordDialogOpen(true);
                                }}
                                className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-purple-600/60 transition-all border border-white/20"
                              >
                                {tour.password_protected ? (
                                  <Shield className="w-3.5 h-3.5 text-yellow-300" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{tour.password_protected ? t('tourPassword.protected') : t('tourPassword.title')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedTourForShare({ id: tour.id, title: tour.title });
                                  setShareDialogOpen(true);
                                }}
                                className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-green-600/60 transition-all border border-white/20"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('dashboard.share')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    )}
                  </div>
                  
                  {/* Upload Button - Bottom Right */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUploadCover(tour.id)}
                          disabled={uploadingCover === tour.id}
                          className="absolute bottom-1.5 right-1.5 z-10 h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('dashboard.uploadCover')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={tourToDelete !== null} onOpenChange={(open) => !open && setTourToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.deleteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tourToDelete && deleteTour(tourToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTourForPassword && (
        <TourPasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          tourId={selectedTourForPassword.id}
          isProtected={selectedTourForPassword.password_protected || false}
          onSuccess={() => {
            loadData(); // Recargar tours para actualizar el estado de protección
          }}
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
};

export default Dashboard;