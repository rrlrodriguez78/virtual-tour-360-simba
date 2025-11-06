import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Eye, 
  Plus, 
  Globe, 
  Lock,
  Settings,
  MapPin,
  Upload,
  Move,
  Trash,
  X,
  MousePointer,
  Menu,
  Layers,
  List,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FloorPlanManager from '@/components/editor/FloorPlanManager';
import HotspotEditor from '@/components/editor/HotspotEditor';
import HotspotModal from '@/components/editor/HotspotModal';
import HotspotListManager from '@/components/editor/HotspotListManager';
import { AutoImportDialog } from '@/components/editor/AutoImportDialog';
import { PhotoGroupDialog } from '@/components/editor/PhotoGroupDialog';
import { GuidedPlacementOverlay } from '@/components/editor/GuidedPlacementOverlay';
import { Badge } from '@/components/ui/badge';
import { Tour, FloorPlan, Hotspot } from '@/types/tour';
import { useBulkHotspotCreation } from '@/hooks/useBulkHotspotCreation';
import type { Match } from '@/utils/photoMatcher';
import { cn } from '@/lib/utils';

const EditorAndroid = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  
  // Tour and floor plans
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  
  // Hotspots
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspotIds, setSelectedHotspotIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Hotspot[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [hotspotModalOpen, setHotspotModalOpen] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null);
  const [floorPlansOpen, setFloorPlansOpen] = useState(false);
  const [hotspotsOpen, setHotspotsOpen] = useState(false);
  const [manageHotspotsOpen, setManageHotspotsOpen] = useState(false);
  const [addPointMode, setAddPointMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [wasSaved, setWasSaved] = useState(false);
  
  // Auto-save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Auto-import guided mode
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedMatches, setGuidedMatches] = useState<Match[]>([]);
  const [currentGuidedIndex, setCurrentGuidedIndex] = useState(0);
  const [placedHotspotIds, setPlacedHotspotIds] = useState<string[]>([]);
  const [isPlacingPoint, setIsPlacingPoint] = useState(false);
  const [placementProgress, setPlacementProgress] = useState(0);
  
  // Grupo de Fotos por Plano
  const [photoGroupDialogOpen, setPhotoGroupDialogOpen] = useState(false);
  
  // Hook for bulk creation
  const { createHotspot, isCreating } = useBulkHotspotCreation(
    selectedFloorPlan?.id || '', 
    tour?.id || ''
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      loadTourData();
    }
  }, [user, id]);

  useEffect(() => {
    if (selectedFloorPlan) {
      loadHotspots(selectedFloorPlan.id);
    }
  }, [selectedFloorPlan]);

  // ESC key to exit add point mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && addPointMode) {
        setAddPointMode(false);
        toast.info('Modo agregar punto desactivado');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [addPointMode]);

  const loadTourData = async () => {
    try {
      const { data: tourData, error: tourError } = await supabase
        .from('virtual_tours')
        .select('id, title, description, is_published, tenant_id, created_at, updated_at, password_protected, password_hash, password_updated_at, share_description, share_image_url, cover_image_url, tour_type')
        .eq('id', id)
        .single();

      if (tourError) {
        console.error('❌ Error loading tour:', tourError);
        toast.error('Error al cargar tour');
        setLoading(false);
        return;
      }

      if (tourData) {
        if (!tourData.tenant_id) {
          console.error('🔴 CRITICAL: Tour loaded WITHOUT tenant_id!');
          toast.error('Error: Tour sin tenant_id. Contacta soporte.');
          setLoading(false);
          return;
        }

        setTour({
          ...tourData,
          tour_type: (tourData.tour_type || 'tour_360') as 'tour_360' | 'photo_tour'
        });

        const { data: planData } = await supabase
          .from('floor_plans')
          .select('*')
          .eq('tour_id', id)
          .order('created_at', { ascending: true });

        if (planData && planData.length > 0) {
          setFloorPlans(planData);
          setSelectedFloorPlan(planData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading tour:', error);
      toast.error('Error al cargar tour');
    } finally {
      setLoading(false);
    }
  };

  const loadHotspots = async (floorPlanId: string) => {
    try {
      const { data } = await supabase
        .from('hotspots')
        .select('*')
        .eq('floor_plan_id', floorPlanId)
        .order('created_at', { ascending: true });

      if (data) {
        setHotspots(data);
      }
    } catch (error) {
      console.error('Error loading hotspots:', error);
    }
  };

  const togglePublish = async () => {
    if (!tour) return;

    try {
      const { error } = await supabase
        .from('virtual_tours')
        .update({ is_published: !tour.is_published })
        .eq('id', tour.id);

      if (error) throw error;

      setTour({ ...tour, is_published: !tour.is_published });
      toast.success(tour.is_published ? 'Tour despublicado' : 'Tour publicado');
    } catch (error) {
      console.error('Error toggling publish:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const handleHotspotClick = (hotspotId: string, event: React.MouseEvent) => {
    if (selectMode || event.shiftKey) {
      event.stopPropagation();
      event.preventDefault();
      setSelectedHotspotIds((prev) =>
        prev.includes(hotspotId)
          ? prev.filter((id) => id !== hotspotId)
          : [...prev, hotspotId]
      );
    } else {
      const hotspot = hotspots.find((h) => h.id === hotspotId);
      if (hotspot) {
        setEditingHotspot(hotspot);
        setHotspotModalOpen(true);
      }
    }
  };

  const handleCanvasClick = async (x: number, y: number) => {
    if (isPlacingPoint) {
      toast.warning("⏳ Espera que termine el punto actual", {
        description: "Se está guardando el punto anterior"
      });
      return;
    }
    
    if (guidedMode && currentGuidedIndex < guidedMatches.length) {
      const currentMatch = guidedMatches[currentGuidedIndex];
      
      if (currentMatch.photos.length === 0) {
        toast.error('Este punto no tiene fotos asociadas, se omitirá');
        setCurrentGuidedIndex(prev => prev + 1);
        return;
      }
      
      if (isPlacingPoint) return;
      
      setIsPlacingPoint(true);
      setPlacementProgress(0);
      
      try {
        const progressInterval = setInterval(() => {
          setPlacementProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 100);
        
        const sortedPhotos = currentMatch.photos
          .sort((a, b) => {
            if (!a.captureDate) return 1;
            if (!b.captureDate) return -1;
            return a.captureDate.localeCompare(b.captureDate);
          })
          .map((photo) => ({
            file: photo.file,
            optimizedBlob: photo.optimizedBlob,
            captureDate: photo.captureDate,
          }));

        const hotspot = await createHotspot({
          name: currentMatch.name,
          photos: sortedPhotos,
          position: { x, y },
          displayOrder: currentGuidedIndex + 1,
        });
        
        clearInterval(progressInterval);
        setPlacementProgress(100);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setPlacedHotspotIds(prev => [...prev, hotspot.id]);
        setHotspots(prev => [...prev, hotspot]);
        
        if (currentGuidedIndex < guidedMatches.length - 1) {
          setCurrentGuidedIndex(prev => prev + 1);
          toast.success(`✅ ${currentMatch.name} creado. Siguiente: ${guidedMatches[currentGuidedIndex + 1].name}`);
        } else {
          setGuidedMode(false);
          setCurrentGuidedIndex(0);
          setAddPointMode(false);
          toast.success(`🎉 ¡Completado! ${guidedMatches.length} puntos creados exitosamente`);
        }
      } catch (error) {
        console.error('Error creando hotspot:', error);
        toast.error('No se pudo crear el punto. Intenta de nuevo.');
      } finally {
        setIsPlacingPoint(false);
        setPlacementProgress(0);
      }
      return;
    }
    
    if (!addPointMode || isProcessingClick || hotspotModalOpen) return;
    
    setIsProcessingClick(true);
    
    const lastTitle = localStorage.getItem('lastHotspotTitle');
    const suggestedTitle = lastTitle ? (() => {
      const pattern = /^(.*?)(\d+)$/;
      const match = lastTitle.match(pattern);
      if (match) {
        const prefix = match[1];
        const lastNumber = parseInt(match[2], 10);
        return `${prefix}${lastNumber + 1}`;
      }
      return lastTitle;
    })() : '';
    
    setEditingHotspot({
      id: '',
      title: suggestedTitle,
      description: '',
      x_position: x,
      y_position: y,
      floor_plan_id: selectedFloorPlan?.id || '',
      style: {
        icon: 'MapPin',
        color: '#4285F4',
        size: 32,
      }
    });
    setHotspotModalOpen(true);
    
    setTimeout(() => setIsProcessingClick(false), 500);
  };

  const handleHotspotDrag = async (hotspotId: string, x: number, y: number) => {
    setHotspots((prev) =>
      prev.map((h) => (h.id === hotspotId ? { ...h, x_position: x, y_position: y } : h))
    );
    
    try {
      await supabase
        .from('hotspots')
        .update({ x_position: x, y_position: y })
        .eq('id', hotspotId);
    } catch (error) {
      console.error('Error updating hotspot position:', error);
    }
  };

  const handleSaveHotspot = async (data: Omit<Hotspot, 'floor_plan_id'>) => {
    if (!selectedFloorPlan) return;

    const isNewHotspot = !data.id;

    try {
      if (data.id) {
        const { error } = await supabase
          .from('hotspots')
          .update({
            title: data.title,
            description: data.description,
            x_position: data.x_position,
            y_position: data.y_position,
          })
          .eq('id', data.id);

        if (error) throw error;

        setHotspots((prev) =>
          prev.map((h) => (h.id === data.id ? { ...h, ...data } : h))
        );
        toast.success('Hotspot actualizado');
      } else {
        const { data: newHotspot, error } = await supabase
          .from('hotspots')
          .insert({
            floor_plan_id: selectedFloorPlan.id,
            title: data.title,
            description: data.description,
            x_position: data.x_position,
            y_position: data.y_position,
          })
          .select()
          .single();

        if (error) throw error;

        setHotspots((prev) => [...prev, newHotspot]);
        
        if (data.title && data.title.trim()) {
          localStorage.setItem('lastHotspotTitle', data.title.trim());
        }
        
        toast.success('Hotspot creado');
      }

      setWasSaved(true);
      setHotspotModalOpen(false);
      setEditingHotspot(null);

      if (isNewHotspot && addPointMode) {
        toast.info('Modo agregar punto activo - Toca en el plano para agregar otro');
      }
    } catch (error) {
      console.error('Error saving hotspot:', error);
      throw error;
    }
  };

  const handleCopyHotspots = () => {
    const selected = hotspots.filter((h) => selectedHotspotIds.includes(h.id));
    setClipboard(selected);
    toast.success(`${selected.length} hotspot(s) copiado(s)`);
  };

  const handlePasteHotspots = async () => {
    if (!selectedFloorPlan || clipboard.length === 0) return;

    try {
      const newHotspots = clipboard.map((h) => ({
        floor_plan_id: selectedFloorPlan.id,
        title: `${h.title} (copia)`,
        description: h.description,
        x_position: h.x_position,
        y_position: h.y_position,
      }));

      const { data, error } = await supabase
        .from('hotspots')
        .insert(newHotspots)
        .select();

      if (error) throw error;

      setHotspots((prev) => [...prev, ...data]);
      toast.success(`${data.length} hotspot(s) pegado(s)`);
    } catch (error) {
      console.error('Error pasting hotspots:', error);
      toast.error('Error al pegar hotspots');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedHotspotIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('hotspots')
        .delete()
        .in('id', selectedHotspotIds);

      if (error) throw error;

      setHotspots((prev) => prev.filter((h) => !selectedHotspotIds.includes(h.id)));
      setSelectedHotspotIds([]);
      toast.success(`${selectedHotspotIds.length} hotspot(s) eliminado(s)`);
    } catch (error) {
      console.error('Error deleting hotspots:', error);
      toast.error('Error al eliminar hotspots');
    }
  };

  const handleDuplicateHotspot = async (hotspot: Hotspot) => {
    if (!selectedFloorPlan) return;

    try {
      const { data, error } = await supabase
        .from('hotspots')
        .insert({
          floor_plan_id: selectedFloorPlan.id,
          title: `${hotspot.title} (copia)`,
          description: hotspot.description,
          x_position: hotspot.x_position + 20,
          y_position: hotspot.y_position + 20,
        })
        .select()
        .single();

      if (error) throw error;

      setHotspots((prev) => [...prev, data]);
      toast.success('Hotspot duplicado');
    } catch (error) {
      console.error('Error duplicating hotspot:', error);
      toast.error('Error al duplicar hotspot');
    }
  };

  const handleDeleteHotspot = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hotspots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setHotspots((prev) => prev.filter((h) => h.id !== id));
      toast.success('Hotspot eliminado');
    } catch (error) {
      console.error('Error deleting hotspot:', error);
      toast.error('Error al eliminar hotspot');
    }
  };

  const handleStartGuidedPlacement = (matches: Match[]) => {
    setGuidedMatches(matches);
    setCurrentGuidedIndex(0);
    setPlacedHotspotIds([]);
    setGuidedMode(true);
    setImportDialogOpen(false);
    
    setAddPointMode(true);
    setMoveMode(false);
    setSelectMode(false);
    
    toast.success(`🎯 Modo guiado activado. Toca en el plano para colocar ${matches.length} puntos`);
  };

  const handleSkipPoint = () => {
    if (currentGuidedIndex < guidedMatches.length - 1) {
      setCurrentGuidedIndex(prev => prev + 1);
      toast.info(`${guidedMatches[currentGuidedIndex].name} omitido`);
    }
  };

  const handleUndoPoint = async () => {
    if (placedHotspotIds.length === 0) return;
    
    const lastHotspotId = placedHotspotIds[placedHotspotIds.length - 1];
    
    try {
      await supabase
        .from('hotspots')
        .delete()
        .eq('id', lastHotspotId);
      
      setPlacedHotspotIds(prev => prev.slice(0, -1));
      setCurrentGuidedIndex(prev => Math.max(0, prev - 1));
      setHotspots(prev => prev.filter(h => h.id !== lastHotspotId));
      
      toast.success('Último punto eliminado');
    } catch (error) {
      console.error('Error undoing point:', error);
      toast.error('No se pudo deshacer');
    }
  };

  const handleCancelGuided = () => {
    setGuidedMode(false);
    setGuidedMatches([]);
    setCurrentGuidedIndex(0);
    setPlacedHotspotIds([]);
    toast.info('Modo guiado cancelado');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header - Compact */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(-1)}
            className="h-10 w-10 p-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 mx-3 min-w-0">
            <h1 className="text-base font-bold truncate">{tour?.title}</h1>
            {tour?.tour_type && (
              <Badge variant={tour.tour_type === 'tour_360' ? 'default' : 'secondary'} className="text-xs mt-1">
                {tour.tour_type === 'tour_360' ? '360°' : 'Fotos'}
              </Badge>
            )}
          </div>

          <div className="flex gap-1">
            <Button 
              variant={tour?.is_published ? "outline" : "default"}
              size="sm"
              onClick={togglePublish}
              className="h-10 w-10 p-0"
            >
              {tour?.is_published ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </Button>
            {tour?.is_published && (
              <Button 
                size="sm"
                onClick={() => navigate(`/viewer/${id}`)}
                className="h-10 w-10 p-0"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Floor Plan Tabs - Horizontal Scroll */}
        {floorPlans.length > 0 && (
          <div className="overflow-x-auto px-3 pb-2">
            <Tabs
              value={selectedFloorPlan?.id}
              onValueChange={(value) => {
                const plan = floorPlans.find((p) => p.id === value);
                if (plan) setSelectedFloorPlan(plan);
              }}
            >
              <TabsList className="w-auto">
                {floorPlans.map((plan) => (
                  <TabsTrigger key={plan.id} value={plan.id} className="text-xs">
                    {plan.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Main Canvas Area - Full Screen */}
      <div className="flex-1 relative">
        {floorPlans.length > 0 && selectedFloorPlan ? (
          <>
            {floorPlans.map((plan) => (
              plan.id === selectedFloorPlan.id && (
                <HotspotEditor
                  key={plan.id}
                  imageUrl={plan.image_url}
                  hotspots={hotspots}
                  selectedIds={selectedHotspotIds}
                  onHotspotClick={handleHotspotClick}
                  onHotspotDrag={handleHotspotDrag}
                  onCanvasClick={handleCanvasClick}
                  readOnly={!addPointMode && !moveMode}
                  selectMode={selectMode}
                  moveMode={moveMode}
                  isPlacingPoint={isPlacingPoint}
                  placementProgress={placementProgress}
                  currentPointIndex={currentGuidedIndex}
                  totalPoints={guidedMatches.length}
                />
              )
            ))}

            {/* Status Badge Overlay */}
            {addPointMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                <Badge className="animate-pulse bg-primary text-primary-foreground px-4 py-2 text-sm shadow-lg">
                  🎯 Modo Agregar - Toca para colocar punto
                </Badge>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full p-6">
            <Card className="p-8 text-center max-w-sm">
              <h2 className="text-lg font-bold mb-2">{t('floorPlan.noFloors')}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t('floorPlan.addToStart')}
              </p>
              <Button onClick={() => setFloorPlansOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Plano
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Action Bar - Fixed */}
      <div className="sticky bottom-0 z-50 bg-background border-t shadow-lg">
        <div className="flex items-center justify-around p-2">
          {/* Floor Plans Drawer */}
          <Drawer open={floorPlansOpen} onOpenChange={setFloorPlansOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" className="flex-col h-auto py-2 px-3">
                <Layers className="w-5 h-5 mb-1" />
                <span className="text-xs">Planos</span>
                <Badge variant="secondary" className="mt-1 text-xs">{floorPlans.length}</Badge>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Planos del Tour</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {tour && tour.tenant_id ? (
                  <FloorPlanManager
                    tour={tour}
                    floorPlans={floorPlans}
                    onFloorPlanSelect={(plan) => {
                      setSelectedFloorPlan(plan);
                      setFloorPlansOpen(false);
                    }}
                    onFloorPlansUpdate={setFloorPlans}
                    isMobile={true}
                  />
                ) : (
                  <p className="text-sm text-destructive">
                    ⚠️ Error: Tour sin tenant_id
                  </p>
                )}
              </div>
            </DrawerContent>
          </Drawer>

          {/* Hotspots List Drawer */}
          <Drawer open={hotspotsOpen} onOpenChange={setHotspotsOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" className="flex-col h-auto py-2 px-3">
                <List className="w-5 h-5 mb-1" />
                <span className="text-xs">Puntos</span>
                <Badge variant="secondary" className="mt-1 text-xs">{hotspots.length}</Badge>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Lista de Hotspots</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                {hotspots.map((hotspot, index) => (
                  <Card
                    key={hotspot.id}
                    className={cn(
                      "p-3 cursor-pointer transition-colors",
                      selectedHotspotIds.includes(hotspot.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                    onClick={() => {
                      setEditingHotspot(hotspot);
                      setHotspotModalOpen(true);
                      setHotspotsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground">
                        {index + 1}
                      </div>
                      <span className="font-medium">{hotspot.title}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </DrawerContent>
          </Drawer>

          {/* Add Point Button */}
          <Button 
            onClick={() => {
              setAddPointMode(!addPointMode);
              if (!addPointMode) {
                setMoveMode(false);
                setSelectMode(false);
              }
            }}
            className={cn(
              "flex-col h-auto py-2 px-4",
              addPointMode && "bg-primary animate-pulse"
            )}
          >
            <Plus className="w-6 h-6 mb-1" />
            <span className="text-xs">{addPointMode ? 'Activo' : 'Agregar'}</span>
          </Button>

          {/* Tools Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex-col h-auto py-2 px-3">
                <Settings className="w-5 h-5 mb-1" />
                <span className="text-xs">Herramientas</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem 
                onClick={() => {
                  setMoveMode(!moveMode);
                  if (!moveMode) {
                    setSelectMode(false);
                    setAddPointMode(false);
                  }
                }}
              >
                <Move className="w-4 h-4 mr-2" />
                {moveMode ? 'Desactivar' : 'Activar'} Mover
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  setSelectMode(!selectMode);
                  if (!selectMode) {
                    setMoveMode(false);
                    setAddPointMode(false);
                  } else {
                    setSelectedHotspotIds([]);
                  }
                }}
              >
                <MousePointer className="w-4 h-4 mr-2" />
                {selectMode ? 'Desactivar' : 'Activar'} Seleccionar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setImportDialogOpen(true)}
                disabled={!selectedFloorPlan}
              >
                <Upload className="w-4 h-4 mr-2" />
                Auto Avance
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setPhotoGroupDialogOpen(true)}
                disabled={!selectedFloorPlan || hotspots.length === 0}
              >
                <Upload className="w-4 h-4 mr-2" />
                Grupo FP
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDeleteSelected}
                disabled={selectedHotspotIds.length === 0}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="w-4 h-4 mr-2" />
                Borrar ({selectedHotspotIds.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More Actions */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" className="flex-col h-auto py-2 px-3">
                <Menu className="w-5 h-5 mb-1" />
                <span className="text-xs">Más</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[50vh]">
              <SheetHeader>
                <SheetTitle>Acciones Adicionales</SheetTitle>
              </SheetHeader>
              <div className="space-y-2 mt-4">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleCopyHotspots}
                  disabled={selectedHotspotIds.length === 0}
                >
                  Copiar Seleccionados
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handlePasteHotspots}
                  disabled={clipboard.length === 0}
                >
                  Pegar Hotspots
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Modals and Dialogs */}
      <HotspotModal
        isOpen={hotspotModalOpen}
        onClose={() => {
          setHotspotModalOpen(false);
          setEditingHotspot(null);
          if (!wasSaved && editingHotspot && !editingHotspot.id) {
            setAddPointMode(false);
          }
          setWasSaved(false);
        }}
        onSave={handleSaveHotspot}
        initialData={editingHotspot || undefined}
        mode={editingHotspot?.id ? 'edit' : 'create'}
        allHotspots={hotspots}
        tourType={tour?.tour_type}
        tourId={tour?.id}
      />

      <HotspotListManager
        isOpen={manageHotspotsOpen}
        onClose={() => setManageHotspotsOpen(false)}
        hotspots={hotspots}
        onEdit={(hotspot) => {
          setEditingHotspot(hotspot);
          setHotspotModalOpen(true);
          setManageHotspotsOpen(false);
        }}
        onDelete={handleDeleteHotspot}
        onDuplicate={handleDuplicateHotspot}
        onFocus={(hotspot) => {
          setSelectedHotspotIds([hotspot.id]);
          toast.info(`Enfocando: ${hotspot.title}`);
        }}
      />

      <AutoImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onStartPlacement={handleStartGuidedPlacement}
      />

      <PhotoGroupDialog
        open={photoGroupDialogOpen}
        onOpenChange={setPhotoGroupDialogOpen}
        existingHotspots={hotspots}
        floorPlanId={selectedFloorPlan?.id || ''}
        tourId={tour?.id || ''}
        tenantId={tour?.tenant_id}
        onPhotosAdded={() => {
          if (selectedFloorPlan) {
            loadHotspots(selectedFloorPlan.id);
          }
        }}
      />
      
      {guidedMode && guidedMatches.length > 0 && (
        <GuidedPlacementOverlay
          matches={guidedMatches}
          currentIndex={currentGuidedIndex}
          onPointPlaced={() => {}}
          onSkip={handleSkipPoint}
          onUndo={handleUndoPoint}
          onCancel={handleCancelGuided}
          isPlacing={isPlacingPoint}
          placementProgress={placementProgress}
        />
      )}
    </div>
  );
};

export default EditorAndroid;
