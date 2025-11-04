import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/custom-client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ViewerHeader } from '@/components/viewer/ViewerHeader';
import ViewerControls from '@/components/viewer/ViewerControls';
import { ViewerCanvas } from '@/components/viewer/ViewerCanvas';
import { HotspotPoint } from '@/components/viewer/HotspotPoint';
import { HotspotModal } from '@/components/viewer/HotspotModal';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';
import { PhotoGalleryViewer } from '@/components/viewer/PhotoGalleryViewer';
import { OrientationWarning } from '@/components/viewer/OrientationWarning';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { Tour, FloorPlan, Hotspot, PanoramaPhoto } from '@/types/tour';
import { TourPasswordPrompt } from '@/components/viewer/TourPasswordPrompt';
import { hybridStorage } from '@/utils/hybridStorage';
import { Badge } from '@/components/ui/badge';

const Viewer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { shouldShowOrientationWarning, lockLandscape, unlockOrientation, isMobile, isStandalone, isLandscape } = useDeviceOrientation();
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [currentFloorPlanId, setCurrentFloorPlanId] = useState<string | null>(null);
  const [hotspotsByFloor, setHotspotsByFloor] = useState<Record<string, Hotspot[]>>({});
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panoramaPhotos, setPanoramaPhotos] = useState<PanoramaPhoto[]>([]);
  const [showPanoramaViewer, setShowPanoramaViewer] = useState(false);
  const [activePanoramaPhoto, setActivePanoramaPhoto] = useState<PanoramaPhoto | null>(null);
  const [tourType, setTourType] = useState<'tour_360' | 'photo_tour'>('tour_360');
  const [userDismissedWarning, setUserDismissedWarning] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Auto-dismiss warning cuando el usuario rota manualmente a landscape
  useEffect(() => {
    if (isLandscape && !userDismissedWarning && isMobile) {
      setUserDismissedWarning(true);
    }
  }, [isLandscape, userDismissedWarning, isMobile]);

  // Handler mejorado para forzar landscape
  const handleForceLandscape = async () => {
    setUserDismissedWarning(true);
    
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const success = await lockLandscape();
      
      if (success) {
        toast.success(t('viewer.landscapeLocked'));
      } else {
        toast.error(
          t('viewer.enableAutoRotate'),
          { 
            duration: 6000,
            description: t('viewer.rotateManually')
          }
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotSupportedError') {
          toast.error(t('viewer.rotationNotSupported'));
        } else if (error.name === 'SecurityError') {
          toast.error(t('viewer.installPwaForRotation'));
        } else {
          toast.error(t('viewer.rotationError'));
        }
      } else {
        toast.error(t('viewer.rotationError'));
      }
    }
  };

  // Intentar rotación automática al entrar (solo móviles)
  useEffect(() => {
    const tryAutoRotate = async () => {
      if (isMobile && !userDismissedWarning && isStandalone) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          await lockLandscape();
        } catch (error) {
          // Silently fail
        }
      }
    };
    tryAutoRotate();
  }, [isMobile, isStandalone, userDismissedWarning]);

  useEffect(() => {
    loadTourData();
  }, [id]);

  // Track tour view for analytics
  useEffect(() => {
    if (!tour || !id) return;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Record initial view
    const recordView = async () => {
      try {
        await supabase.from('tour_views').insert({
          tour_id: id,
          viewer_id: user?.id || null,
          session_id: sessionId,
          ip_address: null, // Could be added via edge function if needed
          user_agent: navigator.userAgent
        });
      } catch (error) {
        console.error('Error recording tour view:', error);
      }
    };

    recordView();

    // Record duration when user leaves
    const handleBeforeUnload = async () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      
      // Use sendBeacon for reliable tracking on page unload
      const data = {
        tour_id: id,
        viewer_id: user?.id || null,
        session_id: sessionId,
        duration_seconds: duration,
        user_agent: navigator.userAgent
      };

      // Try to update the existing view record
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tour_views?session_id=eq.${sessionId}`,
        JSON.stringify(data)
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also record duration when component unmounts
      const duration = Math.floor((Date.now() - startTime) / 1000);
      supabase.from('tour_views')
        .update({ duration_seconds: duration })
        .eq('session_id', sessionId)
        .then(() => {});
    };
  }, [tour, id, user]);

  const loadTourData = async () => {
    try {
      if (!id || id === ':id' || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        setLoading(false);
        return;
      }

      // 1. Intentar cargar desde almacenamiento local primero (offline-first)
      try {
        const cachedTour = await hybridStorage.loadTour(id);
        
        if (cachedTour) {
          // Validar integridad del tour cacheado
          const hasFloorPlans = cachedTour.floorPlans && cachedTour.floorPlans.length > 0;
          const hasHotspots = cachedTour.hotspots && cachedTour.hotspots.length > 0;
          
          // Contar fotos totales
          let totalPhotos = 0;
          if (cachedTour.hotspots) {
            cachedTour.hotspots.forEach(h => {
              if ((h as any).photos) {
                totalPhotos += (h as any).photos.length;
              }
            });
          }
          
          if (!hasFloorPlans || !hasHotspots) {
            console.warn('⚠️ Tour incompleto en cache (faltan planos o hotspots)');
            if (!navigator.onLine) {
              toast.error('Tour incompleto en modo offline', {
                description: 'Intenta volver a descargar este tour con internet'
              });
              setLoading(false);
              return;
            }
            // Si hay internet, continuar con carga normal
          } else {
            console.log(`✅ Tour cargado desde offline (${totalPhotos} fotos)`);
            setIsOfflineMode(true);
            setTour(cachedTour.data);
            setFloorPlans(cachedTour.floorPlans);
            setTourType((cachedTour.data.tour_type || 'tour_360') as 'tour_360' | 'photo_tour');
            
            // Agrupar hotspots por floor plan
            const hotspotsMap: Record<string, Hotspot[]> = {};
            cachedTour.hotspots.forEach(h => {
              if (!hotspotsMap[h.floor_plan_id!]) {
                hotspotsMap[h.floor_plan_id!] = [];
              }
              hotspotsMap[h.floor_plan_id!].push(h);
            });
            setHotspotsByFloor(hotspotsMap);
            
            if (cachedTour.floorPlans.length > 0) {
              setCurrentFloorPlanId(cachedTour.floorPlans[0].id);
            }
            
            setLoading(false);
            return;
          }
        }
      } catch (cacheError) {
        console.log('No se pudo cargar desde caché, intentando Supabase...', cacheError);
      }

      // 2. Si no hay cache o falló, verificar conexión antes de intentar Supabase
      if (!navigator.onLine) {
        toast.error('Sin internet y tour no disponible offline', {
          description: 'Descarga este tour con internet para verlo offline',
          duration: 5000
        });
        setLoading(false);
        return;
      }

      setIsOfflineMode(false);

      // 3. Cargar desde Supabase (requiere internet)
      const { data: tourData, error: tourError } = await supabase
        .from('virtual_tours')
        .select(`
          title, 
          description, 
          is_published,
          tenant_id,
          password_protected,
          password_updated_at,
          tour_type
        `)
        .eq('id', id)
        .maybeSingle();

      if (tourError) {
        console.error('Error al cargar tour:', tourError);
        throw tourError;
      }

      if (!tourData) {
        setLoading(false);
        return;
      }

      // 2. Verificar ownership solo si el usuario está autenticado
      let isOwner = false;
      if (user) {
        const { data: tenantData } = await supabase
          .from('tenants' as any)
          .select('owner_id')
          .eq('id', (tourData as any).tenant_id)
          .maybeSingle();
        
        isOwner = (tenantData as any)?.owner_id === user.id;
      }
      
      if (!tourData.is_published && !isOwner) {
        setLoading(false);
        return;
      }

      // Si el tour está protegido con contraseña y el usuario NO es el dueño
      if (tourData.password_protected && !isOwner) {
        // Verificar si hay un JWT válido en localStorage
        const storedToken = localStorage.getItem(`tour_access_${id}`);
        
        if (storedToken) {
          try {
            // Validate JWT token server-side
            const { data: validationData, error: validationError } = await supabase.functions.invoke(
              'validate-tour-access',
              {
                body: { tour_id: id, access_token: storedToken }
              }
            );

            if (validationError || !validationData?.valid) {
              // Token inválido, expirado, o contraseña cambiada
              localStorage.removeItem(`tour_access_${id}`);
              setPasswordProtected(true);
              setPasswordUpdatedAt(tourData.password_updated_at);
              setShowPasswordPrompt(true);
              setTour({ title: tourData.title, description: tourData.description });
              setLoading(false);
              return;
            }
            // Token válido, continuar con la carga
          } catch (error) {
            console.error('Error validating token:', error);
            localStorage.removeItem(`tour_access_${id}`);
            setPasswordProtected(true);
            setPasswordUpdatedAt(tourData.password_updated_at);
            setShowPasswordPrompt(true);
            setTour({ title: tourData.title, description: tourData.description });
            setLoading(false);
            return;
          }
        } else {
          console.log('🔒 Tour protegido con contraseña, solicitando acceso');
          setPasswordProtected(true);
          setPasswordUpdatedAt(tourData.password_updated_at);
          setShowPasswordPrompt(true);
          setTour({ title: tourData.title, description: tourData.description });
          setLoading(false);
          return;
        }
      }

      setTour({ 
        title: tourData.title, 
        description: tourData.description,
        tour_type: (tourData.tour_type || 'tour_360') as 'tour_360' | 'photo_tour'
      });
      setTourType((tourData.tour_type || 'tour_360') as 'tour_360' | 'photo_tour');

      const { data: plansData } = await supabase
        .from('floor_plans')
        .select('id, name, image_url')
        .eq('tour_id', id)
        .order('created_at', { ascending: true });

      if (plansData && plansData.length > 0) {
        setFloorPlans(plansData);
        setCurrentFloorPlanId(plansData[0].id);

        // Load ALL hotspots for the tour
        const floorPlanIds = plansData.map(plan => plan.id);
        const { data: allHotspotsData } = await supabase
          .from('hotspots')
          .select(`
            id, title, description, x_position, y_position, 
            has_panorama, panorama_count, floor_plan_id
          `)
          .in('floor_plan_id', floorPlanIds);
        
        // Load first photo for each hotspot
        const hotspotIds = allHotspotsData?.map(h => h.id) || [];
        const { data: photosData } = hotspotIds.length > 0 ? await supabase
          .from('panorama_photos')
          .select('hotspot_id, photo_url, display_order')
          .in('hotspot_id', hotspotIds)
          .order('display_order', { ascending: true })
          : { data: [] };
        
        // Create a map with only the first photo per hotspot
        const firstPhotosMap = new Map<string, string>();
        if (photosData) {
          photosData.forEach(photo => {
            if (!firstPhotosMap.has(photo.hotspot_id)) {
              firstPhotosMap.set(photo.hotspot_id, photo.photo_url);
            }
          });
        }


        // Group hotspots by floor plan
        const hotspotsMap: Record<string, Hotspot[]> = {};
        if (allHotspotsData) {
          allHotspotsData.forEach(h => {
            if (!hotspotsMap[h.floor_plan_id!]) {
              hotspotsMap[h.floor_plan_id!] = [];
            }
            
            hotspotsMap[h.floor_plan_id!].push({
              id: h.id,
              title: h.title,
              description: h.description,
              x_position: h.x_position,
              y_position: h.y_position,
              first_photo_url: firstPhotosMap.get(h.id),
              has_panorama: h.has_panorama ?? false,
              panorama_count: h.panorama_count ?? 0,
            } as Hotspot);
          });
        }
        setHotspotsByFloor(hotspotsMap);
      }
    } catch (error) {
      console.error('Error loading tour:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    // El estado se sincroniza automáticamente por el listener fullscreenchange
  }, []);

  const loadPanoramaPhotos = async (hotspotId: string) => {
    try {
      // Prioridad 1: Cargar desde cache offline (siempre primero)
      if (id) {
        const cachedTour = await hybridStorage.loadTour(id);
        if (cachedTour) {
          const hotspot = cachedTour.hotspots.find(h => h.id === hotspotId);
          if (hotspot && (hotspot as any).photos && (hotspot as any).photos.length > 0) {
            console.log('✅ Fotos cargadas desde offline:', (hotspot as any).photos.length);
            return (hotspot as any).photos || [];
          }
        }
      }

      // Prioridad 2: Solo intentar Supabase si hay internet
      if (!navigator.onLine) {
        console.warn('⚠️ Sin internet y sin fotos en cache para hotspot:', hotspotId);
        toast.error('No hay fotos disponibles offline para este punto', {
          description: 'Descarga este tour para verlo sin conexión'
        });
        return [];
      }

      // Prioridad 3: Cargar desde Supabase (con internet)
      console.log('📡 Cargando fotos desde Supabase...');
      const { data, error } = await supabase
        .from('panorama_photos')
        .select('id, hotspot_id, photo_url, description, display_order, capture_date')
        .eq('hotspot_id', hotspotId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading panorama photos:', error);
      toast.error('Error al cargar fotos panorámicas', {
        description: 'Intenta descargar este tour para uso offline'
      });
      return [];
    }
  };

  const handleHotspotClick = async (hotspot: Hotspot, event?: React.MouseEvent) => {
    setSelectedHotspot(hotspot);
    
    if (hotspot.has_panorama && hotspot.panorama_count && hotspot.panorama_count > 0) {
      const photos = await loadPanoramaPhotos(hotspot.id);
      if (photos.length > 0) {
        setPanoramaPhotos(photos);
        setActivePanoramaPhoto(photos[0]);
        setShowPanoramaViewer(true);
      } else {
        setShowPanoramaViewer(false);
      }
    } else {
      setShowPanoramaViewer(false);
    }
  };

  const currentFloorPlan = floorPlans.find(fp => fp.id === currentFloorPlanId);
  const currentHotspots = currentFloorPlan ? hotspotsByFloor[currentFloorPlan.id] || [] : [];

  const handleNextHotspot = useCallback(() => {
    if (!selectedHotspot) return;
    const currentIdx = currentHotspots.findIndex(h => h.id === selectedHotspot.id);
    if (currentIdx < currentHotspots.length - 1) {
      setSelectedHotspot(currentHotspots[currentIdx + 1]);
    }
  }, [selectedHotspot, currentHotspots]);

  const handlePreviousHotspot = useCallback(() => {
    if (!selectedHotspot) return;
    const currentIdx = currentHotspots.findIndex(h => h.id === selectedHotspot.id);
    if (currentIdx > 0) {
      setSelectedHotspot(currentHotspots[currentIdx - 1]);
    }
  }, [selectedHotspot, currentHotspots]);

  const hotspotCounts = Object.keys(hotspotsByFloor).reduce((acc, floorId) => {
    acc[floorId] = hotspotsByFloor[floorId].length;
    return acc;
  }, {} as Record<string, number>);

  // Sincronizar estado de fullscreen automáticamente
  useEffect(() => {
    const handleFullscreenChange = () => {
      const newFullscreenState = !!document.fullscreenElement;
      setIsFullscreen(newFullscreenState);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedHotspot) {
        setSelectedHotspot(null);
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      if (e.key === 'ArrowRight' && selectedHotspot) {
        handleNextHotspot();
      }
      if (e.key === 'ArrowLeft' && selectedHotspot) {
        handlePreviousHotspot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHotspot, toggleFullscreen, handleNextHotspot, handlePreviousHotspot]);

  // Handler para reintentar rotación
  const handleTryRotate = async () => {
    // Ocultar el warning al intentar
    setUserDismissedWarning(true);
    
    const success = await lockLandscape();
    if (!success) {
      toast.error(
        t('viewer.rotateManually'),
        { duration: 5000 }
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-lg">{t('viewer.loadingTour')}</p>
        </div>
      </div>
    );
  }

  if (!tour || (floorPlans.length === 0 && !showPasswordPrompt)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">{t('viewer.tourNotFound')}</h1>
          <p className="text-muted-foreground">
            {t('viewer.tourNotFoundDesc')}
          </p>
        </Card>
      </div>
    );
  }

  const selectedHotspotIndex = selectedHotspot 
    ? currentHotspots.findIndex(h => h.id === selectedHotspot.id)
    : -1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Offline Mode Indicator */}
      {isOfflineMode && (
        <div className="bg-muted border-b border-border px-4 py-2 text-center">
          <Badge variant="secondary" className="gap-2">
            📴 Modo Offline
          </Badge>
        </div>
      )}
      
      {/* Orientation Warning - ACTUALIZADO con onForceLandscape */}
      {shouldShowOrientationWarning && !userDismissedWarning && (
        <OrientationWarning 
          onContinue={() => setUserDismissedWarning(true)}
          onTryRotate={handleTryRotate}
          onForceLandscape={handleForceLandscape} // ← NUEVO PROP
          isStandalone={isStandalone}
        />
      )}
      
      {/* Header */}
      <ViewerHeader
        tourTitle={tour.title}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        unlockOrientation={unlockOrientation}
      />

      {/* Solo renderizar el contenido del viewer si NO estamos mostrando password prompt */}
      {!showPasswordPrompt && currentFloorPlan && (
        <>
          {/* Canvas */}
          <div className="flex-1 relative">
            <ViewerCanvas
              imageUrl={currentFloorPlan.image_url}
              hotspots={currentHotspots}
              onHotspotClick={handleHotspotClick}
              renderHotspot={(hotspot, index) => (
                <HotspotPoint
                  key={hotspot.id}
                  index={index}
                  title={hotspot.title}
                  x={hotspot.x_position}
                  y={hotspot.y_position}
                  onClick={(e) => handleHotspotClick(hotspot, e)}
                  hasPanorama={hotspot.has_panorama}
                />
              )}
            />
          </div>

          {/* Hotspot Modal (for regular hotspots) */}
          {!showPanoramaViewer && (
            <HotspotModal
              hotspot={selectedHotspot}
              onClose={() => setSelectedHotspot(null)}
              onNext={handleNextHotspot}
              onPrevious={handlePreviousHotspot}
              currentIndex={selectedHotspotIndex}
              totalCount={currentHotspots.length}
              availableHotspots={currentHotspots}
              onHotspotSelect={(hotspot) => {
                const fullHotspot = currentHotspots.find(h => h.id === hotspot.id);
                if (fullHotspot) {
                  setSelectedHotspot(null);
                  setTimeout(() => handleHotspotClick(fullHotspot), 100);
                }
              }}
              floorPlans={floorPlans}
              currentFloorPlan={currentFloorPlan}
              onFloorChange={setCurrentFloorPlanId}
            />
          )}

          {/* Viewer - Conditionally render based on tour type */}
          {tourType === 'tour_360' && (
            <PanoramaViewer
              isVisible={showPanoramaViewer}
              onClose={() => {
                setShowPanoramaViewer(false);
                setSelectedHotspot(null);
              }}
              photos={panoramaPhotos}
              activePhoto={activePanoramaPhoto}
              setActivePhoto={setActivePanoramaPhoto}
              hotspotName={selectedHotspot?.title || ''}
              allHotspotsOnFloor={currentHotspots}
              onNavigate={async (hotspot) => {
                // Guardar la fecha actual ANTES de cambiar de hotspot
                const currentDate = activePanoramaPhoto?.capture_date;
                
                // Cargar fotos del nuevo hotspot ANTES de cambiar el estado
                const photos = await loadPanoramaPhotos(hotspot.id);
                
                if (photos.length === 0) {
                  // Si no hay fotos en absoluto, mostrar error y NO cambiar hotspot
                  toast.error(t('viewer.noPhotosAvailable'), {
                    description: t('viewer.noPhotosDescription', { name: hotspot.title }),
                  });
                  return; // Quedarse en el hotspot actual
                }
                
                // Verificar si hay foto para la fecha actual
                if (currentDate) {
                  const photoWithSameDate = photos.find(p => p.capture_date === currentDate);
                  if (!photoWithSameDate) {
                    // Si no hay foto para la fecha actual, mostrar error y NO cambiar hotspot
                    const formatDate = (dateString: string) => {
                      try {
                        return new Date(dateString).toLocaleDateString(i18n.language, { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      } catch {
                        return dateString;
                      }
                    };
                    
                    toast.error(t('viewer.noPhotoForDate'), {
                      description: t('viewer.noPhotoForDateDescription', { date: formatDate(currentDate) }),
                    });
                    return; // Quedarse en el hotspot actual
                  }
                }
                
                // Si llegamos aquí, hay fotos disponibles para la fecha actual
                setSelectedHotspot(hotspot);
                setPanoramaPhotos(photos);
                
                // Intentar mantener la misma fecha
                let photoToShow = photos[0]; // Fallback: primera foto
                
                if (currentDate) {
                  const photoWithSameDate = photos.find(p => p.capture_date === currentDate);
                  if (photoWithSameDate) {
                    photoToShow = photoWithSameDate;
                  }
                }
                
                setActivePanoramaPhoto(photoToShow);
              }}
              floorPlans={floorPlans}
              currentFloorPlan={currentFloorPlan}
              onFloorChange={(floorPlanId) => {
                setCurrentFloorPlanId(floorPlanId);
                setShowPanoramaViewer(false);
                setSelectedHotspot(null);
              }}
              hotspotsByFloor={hotspotsByFloor}
              tourType={tourType}
              isOfflineMode={isOfflineMode}
              tourId={id}
            />
          )}

          {tourType === 'photo_tour' && (
            <PhotoGalleryViewer
              isVisible={showPanoramaViewer}
              onClose={() => {
                setShowPanoramaViewer(false);
                setSelectedHotspot(null);
              }}
              photos={panoramaPhotos}
              activePhoto={activePanoramaPhoto}
              setActivePhoto={setActivePanoramaPhoto}
              hotspotName={selectedHotspot?.title || ''}
              allHotspotsOnFloor={currentHotspots}
              onNavigate={async (hotspot) => {
                const currentDate = activePanoramaPhoto?.capture_date;
                const photos = await loadPanoramaPhotos(hotspot.id);
                
                if (photos.length === 0) {
                  toast.error(t('viewer.noPhotosAvailable'), {
                    description: t('viewer.noPhotosDescription', { name: hotspot.title }),
                  });
                  return;
                }
                
                if (currentDate) {
                  const photoWithSameDate = photos.find(p => p.capture_date === currentDate);
                  if (!photoWithSameDate) {
                    const formatDate = (dateString: string) => {
                      try {
                        return new Date(dateString).toLocaleDateString(i18n.language, { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        });
                      } catch {
                        return dateString;
                      }
                    };
                    
                    toast.error(t('viewer.noPhotoForDate'), {
                      description: t('viewer.noPhotoForDateDescription', { date: formatDate(currentDate) }),
                    });
                    return;
                  }
                }
                
                setSelectedHotspot(hotspot);
                setPanoramaPhotos(photos);
                
                let photoToShow = photos[0];
                if (currentDate) {
                  const photoWithSameDate = photos.find(p => p.capture_date === currentDate);
                  if (photoWithSameDate) {
                    photoToShow = photoWithSameDate;
                  }
                }
                
                setActivePanoramaPhoto(photoToShow);
              }}
              floorPlans={floorPlans}
              currentFloorPlan={currentFloorPlan}
              onFloorChange={(floorPlanId) => {
                setCurrentFloorPlanId(floorPlanId);
                setShowPanoramaViewer(false);
                setSelectedHotspot(null);
              }}
              hotspotsByFloor={hotspotsByFloor}
            />
          )}

          {/* Floor Controls */}
          <ViewerControls
            floorPlans={floorPlans}
            activeFloorPlanId={currentFloorPlanId}
            onFloorPlanChange={setCurrentFloorPlanId}
          />
        </>
      )}

      {/* Password Prompt for Protected Tours */}
      {showPasswordPrompt && tour && (
        <TourPasswordPrompt
          open={showPasswordPrompt}
          tourId={id!}
          tourTitle={tour.title}
          onSuccess={(passwordUpdatedAt) => {
            setShowPasswordPrompt(false);
            loadTourData();
          }}
        />
      )}
    </div>
  );
};

export default Viewer;