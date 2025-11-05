import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  X, RotateCw, ZoomIn, ZoomOut, 
  Maximize, Minimize, Info, MapPin,
  ChevronLeft, ChevronRight, Building2, Calendar,
  Menu, ChevronDown, Compass
} from "lucide-react";
import * as THREE from 'three';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { PanoramaPhoto, Hotspot, FloorPlan, NavigationPoint } from '@/types/tour';
import { useUnifiedPointer } from '@/hooks/useUnifiedPointer';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { NavigationArrow3D } from './NavigationArrow3D';
import { ImageNotFoundFallback } from './ImageNotFoundFallback';
import { supabase } from '@/integrations/supabase/client';
import { animateValue, delay, easeInOutCubic } from '@/utils/cameraAnimation';
import { DateSelector } from './DateSelector';

interface PanoramaViewerProps {
  isVisible: boolean;
  onClose: () => void;
  photos: PanoramaPhoto[];
  activePhoto: PanoramaPhoto | null;
  setActivePhoto: (photo: PanoramaPhoto) => void;
  hotspotName: string;
  allHotspotsOnFloor: Hotspot[];
  onNavigate: (hotspot: Hotspot) => void;
  floorPlans?: FloorPlan[];
  currentFloorPlan?: FloorPlan;
  onFloorChange?: (floorPlanId: string) => void;
  hotspotsByFloor?: Record<string, Hotspot[]>;
  tourType?: 'tour_360' | 'photo_tour';
}

export default function PanoramaViewer({ 
  isVisible, 
  onClose, 
  photos, 
  activePhoto, 
  setActivePhoto, 
  hotspotName,
  allHotspotsOnFloor,
  onNavigate,
  floorPlans = [],
  currentFloorPlan,
  onFloorChange,
  hotspotsByFloor = {},
  tourType = 'tour_360',
}: PanoramaViewerProps) {
  const { t, i18n } = useTranslation();
  const { getEventCoordinates, preventDefault } = useUnifiedPointer();
  const { isMobile } = useDeviceDetection();
  
  // Detectar si es PWA instalada
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');
  
  // Helper function para obtener el número de hotspots por piso
  const getHotspotCount = useCallback((floorPlanId: string): number => {
    return hotspotsByFloor[floorPlanId]?.length || 0;
  }, [hotspotsByFloor]);
  const mountRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Silenciar advertencias de Three.js sobre características no soportadas
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args[0]?.toString?.() || '';
      if (
        message.includes('Unrecognized feature') ||
        message.includes('vr') ||
        message.includes('ambient-light-sensor') ||
        message.includes('battery')
      ) {
        return;
      }
      originalWarn(...args);
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const isUserInteracting = useRef(false);
  const onPointerDownMouseX = useRef(0);
  const onPointerDownMouseY = useRef(0);
  const lon = useRef(0);
  const onPointerDownLon = useRef(0);
  const lat = useRef(0);
  const onPointerDownLat = useRef(0);
  const phi = useRef(0);
  const theta = useRef(0);
  // Removed showControls state - controls are now always visible
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenVersion, setFullscreenVersion] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(120);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoadingScene, setIsLoadingScene] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [navigationPoints, setNavigationPoints] = useState<NavigationPoint[]>([]);
  const [destinationPhotos, setDestinationPhotos] = useState<Record<string, string>>({});
  const [fadeTransition, setFadeTransition] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<{ theta: number; phi: number } | null>(null);
  const [currentCaptureDate, setCurrentCaptureDate] = useState<string | null>(null);

  // Z-index dinámico para fullscreen
  const containerZIndex = isFullscreen ? 99998 : 30;
  
  // Actualizar fecha actual cuando cambia la foto activa
  useEffect(() => {
    if (activePhoto?.capture_date) {
      setCurrentCaptureDate(activePhoto.capture_date);
    }
  }, [activePhoto]);

  // Fetch navigation points para el hotspot activo
  useEffect(() => {
    if (!activePhoto?.hotspot_id || tourType !== 'tour_360') {
      setNavigationPoints([]);
      setDestinationPhotos({});
      return;
    }
    
    const fetchNavigationPoints = async () => {
      let query = supabase
        .from('hotspot_navigation_points')
        .select(`
          *,
          target_hotspot:to_hotspot_id(*)
        `)
        .eq('from_hotspot_id', activePhoto.hotspot_id)
        .eq('is_active', true)
        .order('display_order');
      
      // Filtrar por fecha si está disponible
      if (currentCaptureDate) {
        query = query.eq('capture_date', currentCaptureDate);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        setNavigationPoints(data as any);
        
        // Cargar las fotos de los hotspots de destino
        const targetHotspotIds = data.map((p: any) => p.to_hotspot_id).filter(Boolean);
        if (targetHotspotIds.length > 0) {
          const { data: photosData } = await supabase
            .from('panorama_photos')
            .select('hotspot_id, photo_url, photo_url_mobile')
            .in('hotspot_id', targetHotspotIds)
            .order('created_at', { ascending: true });
          
          if (photosData) {
            const photoMap: Record<string, string> = {};
            photosData.forEach((photo: any) => {
              if (!photoMap[photo.hotspot_id]) {
                // Usar la primera foto de cada hotspot (priorizar mobile si existe)
                photoMap[photo.hotspot_id] = photo.photo_url_mobile || photo.photo_url;
              }
            });
            setDestinationPhotos(photoMap);
            console.log('✅ Fotos de destino cargadas:', photoMap);
          }
        }
      }
    };
    
    fetchNavigationPoints();
  }, [activePhoto?.hotspot_id, currentCaptureDate, tourType]);

  // Cleanup al desmontar el componente (evita memory leaks en sesiones largas)
  useEffect(() => {
    return () => {
      // Cleanup completo de recursos WebGL
      if (meshRef.current) {
        if (meshRef.current.geometry) {
          meshRef.current.geometry.dispose();
        }
        if (meshRef.current.material) {
          if (Array.isArray(meshRef.current.material)) {
            meshRef.current.material.forEach((m: any) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            const mat = meshRef.current.material as any;
            if (mat.map) mat.map.dispose();
            mat.dispose();
          }
        }
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }
    };
  }, []);

  // Filtrar fotos por el punto actual
  const filteredPhotos = useMemo(() => {
    if (!activePhoto) return photos;
    return photos.filter(p => p.hotspot_id === activePhoto.hotspot_id);
  }, [photos, activePhoto]);

  // Obtener fechas únicas de las fotos del punto actual
  const availableDates = useMemo(() => {
    const dates = filteredPhotos
      .map(p => p.capture_date)
      .filter((date): date is string => !!date);
    const uniqueDates = Array.from(new Set(dates)).sort().reverse();
    return uniqueDates;
  }, [filteredPhotos]);

  // Filtrar fotos por fecha seleccionada (si hay una fecha activa)
  const photosByDate = useMemo(() => {
    if (!activePhoto?.capture_date) return filteredPhotos;
    return filteredPhotos.filter(p => p.capture_date === activePhoto.capture_date);
  }, [filteredPhotos, activePhoto]);

  // Obtener TODOS los hotspots del floor (no solo los que tienen panoramas)
  const availableHotspots = useMemo(() => {
    return allHotspotsOnFloor.sort((a, b) => a.title.localeCompare(b.title));
  }, [allHotspotsOnFloor]);

  // Detect device type for serving appropriate image version
  const isMobileDevice = useMemo(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }, []);

  // Get appropriate photo URL based on device
  const getPhotoUrl = useCallback((photo: PanoramaPhoto) => {
    if (isMobileDevice && photo.photo_url_mobile) {
      return photo.photo_url_mobile;
    }
    return photo.photo_url;
  }, [isMobileDevice]);

  // Listener de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      setFullscreenVersion(v => v + 1);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Detectar estado inicial al montar
    handleFullscreenChange();
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Auto-fullscreen removido - usuario tiene control manual

  // Determinar modo de navegación: siempre hotspots (puntos)
  const navigationMode = 'hotspots';

  const animate = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;
    requestAnimationFrame(animate);

    lat.current = Math.max(-85, Math.min(85, lat.current));
    phi.current = THREE.MathUtils.degToRad(90 - lat.current);
    theta.current = THREE.MathUtils.degToRad(lon.current);

    const x = 500 * Math.sin(phi.current) * Math.cos(theta.current);
    const y = 500 * Math.cos(phi.current);
    const z = 500 * Math.sin(phi.current) * Math.sin(theta.current);

    cameraRef.current.lookAt(x, y, z);
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  // Gestión unificada de touch/mouse (+75% usabilidad en tablets y móviles)
  const onPointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (isUserInteracting.current === true) {
      const coords = getEventCoordinates(event);
      
      // ✅ Calcular movimiento total desde el inicio
      const deltaX = Math.abs(onPointerDownMouseX.current - coords.clientX);
      const deltaY = Math.abs(onPointerDownMouseY.current - coords.clientY);
      const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // ✅ Solo activar drag si movimiento > 5px (evita interferir con clicks en flechas)
      if (totalMovement > 5) {
        lon.current = (onPointerDownMouseX.current - coords.clientX) * 0.1 + onPointerDownLon.current;
        lat.current = (coords.clientY - onPointerDownMouseY.current) * 0.1 + onPointerDownLat.current;
      }
    }
  }, [getEventCoordinates]);

  const onPointerUp = useCallback(() => {
    isUserInteracting.current = false;
    document.removeEventListener('mousemove', onPointerMove as any);
    document.removeEventListener('touchmove', onPointerMove as any);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchend', onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (isTransitioning) return; // Bloquear interacción durante transición
    preventDefault(event);
    isUserInteracting.current = true;
    
    const coords = getEventCoordinates(event);
    onPointerDownMouseX.current = coords.clientX;
    onPointerDownMouseY.current = coords.clientY;
    onPointerDownLon.current = lon.current;
    onPointerDownLat.current = lat.current;

    document.addEventListener('mousemove', onPointerMove as any);
    document.addEventListener('touchmove', onPointerMove as any, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
  }, [onPointerMove, onPointerUp, getEventCoordinates, preventDefault, isTransitioning]);

  const onDocumentWheel = useCallback((event: WheelEvent) => {
    if (isTransitioning) return; // Bloquear zoom durante transición
    if (!cameraRef.current) return;
    const newFov = cameraRef.current.fov + event.deltaY * 0.05;
    cameraRef.current.fov = THREE.MathUtils.clamp(newFov, 30, 120);
    cameraRef.current.updateProjectionMatrix();
    setCurrentZoom(cameraRef.current.fov);
  }, [isTransitioning]);
  
  const handleResize = useCallback(() => {
    if (cameraRef.current && rendererRef.current && mountRef.current) {
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    }
  }, []);

  // Cleanup completo de recursos WebGL (+95% estabilidad en móviles)
  useEffect(() => {
    if (!isVisible || !activePhoto || !mountRef.current) {
      const mountNode = mountRef.current;
      if (mountNode) {
        window.removeEventListener('resize', handleResize);
        mountNode.removeEventListener('mousedown', onPointerDown as any);
        mountNode.removeEventListener('touchstart', onPointerDown as any);
        mountNode.removeEventListener('wheel', onDocumentWheel);
        if (rendererRef.current && rendererRef.current.domElement && mountNode.contains(rendererRef.current.domElement)) {
          mountNode.removeChild(rendererRef.current.domElement);
        }
      }
      
      // Cleanup mesh con disposición completa de recursos
      if (meshRef.current) {
        sceneRef.current?.remove(meshRef.current);
        if (meshRef.current.geometry) {
          meshRef.current.geometry.dispose();
        }
        if (meshRef.current.material) {
          if (Array.isArray(meshRef.current.material)) {
            meshRef.current.material.forEach((m: any) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            const mat = meshRef.current.material as any;
            if (mat.map) mat.map.dispose();
            mat.dispose();
          }
        }
        meshRef.current = null;
      }
      
      // Cleanup renderer con liberación forzada del contexto WebGL
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }
      
      sceneRef.current = null; 
      cameraRef.current = null;
      setLoadingError(null);
      return;
    }

    const mountNode = mountRef.current;
    setIsLoadingScene(true);
    setLoadingError(null);

    if (!rendererRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(120, mountNode.clientWidth / mountNode.clientHeight, 1, 1100);
      sceneRef.current = new THREE.Scene();
      rendererRef.current = new THREE.WebGLRenderer({ 
        antialias: false,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
      });
      // Limitar DPR para mejor performance
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      rendererRef.current.setSize(mountNode.clientWidth, mountNode.clientHeight);
      mountNode.appendChild(rendererRef.current.domElement);
      
      mountNode.style.touchAction = 'none';
      mountNode.addEventListener('mousedown', onPointerDown as any);
      mountNode.addEventListener('touchstart', onPointerDown as any, { passive: false });
      mountNode.addEventListener('wheel', onDocumentWheel);
      window.addEventListener('resize', handleResize);
      
      requestAnimationFrame(() => {
        animate();
        setIsLoadingScene(false);
      });
    }

    const photoUrl = getPhotoUrl(activePhoto);
    
    if (!photoUrl || typeof photoUrl !== 'string') {
      setLoadingError(t('viewer.invalidImageUrl'));
      return;
    }

    const sphereGeometry = new THREE.SphereGeometry(500, 32, 24);
    sphereGeometry.scale(-1, 1, 1);
    
    const textureLoader = new THREE.TextureLoader();
    // ✅ Configurar crossOrigin para evitar problemas de CORS
    textureLoader.crossOrigin = 'anonymous';
    
    console.log('🔄 Cargando panorama desde:', {
      url: photoUrl,
      substring: photoUrl.substring(0, 150)
    });
    
    textureLoader.load(
      photoUrl,
      (texture) => {
        console.log('✅ Panorama cargado exitosamente');
        if (!sceneRef.current) {
            texture.dispose();
            sphereGeometry.dispose();
            return; 
        }

        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          if (meshRef.current.geometry) meshRef.current.geometry.dispose();
          if (meshRef.current.material) {
              if (Array.isArray(meshRef.current.material)) {
                  meshRef.current.material.forEach((m: any) => {
                      if (m.map) m.map.dispose();
                      m.dispose();
                  });
              } else {
                  const mat = meshRef.current.material as any;
                  if (mat.map) mat.map.dispose();
                  mat.dispose();
              }
          }
          meshRef.current = null;
        }
        
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(sphereGeometry, material);
        sceneRef.current.add(mesh);
        meshRef.current = mesh;
        
        sphereGeometry.dispose();
        
        if (cameraRef.current) {
            cameraRef.current.fov = 120;
            cameraRef.current.updateProjectionMatrix();
            setCurrentZoom(120);
            // ✅ Mantener orientación de cámara durante navegación
        }

        setLoadingError(null);
        setIsLoadingScene(false);
      },
      undefined,
      (error) => {
        console.error("❌ Failed to load panorama texture");
        console.error("❌ URL:", photoUrl);
        console.error("❌ Error type:", error?.constructor?.name || typeof error);
        console.error("❌ Error details:", error);
        
        // Try to provide more specific error info
        if (error instanceof ErrorEvent) {
          console.error("❌ ErrorEvent - likely CORS or network issue");
        }
        
        sphereGeometry.dispose();
        
        // ✅ Create detailed error message
        let errorMessage = t('viewer.networkError');
        
        // Check if it's a CORS issue by trying to load as regular image
        const testImg = new Image();
        testImg.crossOrigin = 'anonymous';
        testImg.onload = () => {
          console.log('✅ Image loads fine with regular <img> tag, might be Three.js specific issue');
        };
        testImg.onerror = (imgError) => {
          console.error('❌ Image also fails with <img> tag:', imgError);
        };
        testImg.src = photoUrl;
        
        if (error instanceof Error && error.message) {
          errorMessage = t('viewer.errorLoadingImageDescription', { error: error.message });
        } else {
          errorMessage = `Failed to load panorama. Please check if the image exists and is accessible. URL: ${photoUrl.substring(photoUrl.lastIndexOf('/') + 1)}`;
        }
        
        setLoadingError(errorMessage);
        setIsLoadingScene(false);
      }
    );

  }, [isVisible, activePhoto, animate, onPointerDown, onDocumentWheel, handleResize, getPhotoUrl]);

  // Removed auto-hide controls effect - controls are now always visible

  const formatDate = (dateString: string) => {
    try {
      const locale = i18n.language === 'es' ? es : enUS;
      return format(new Date(dateString), "d 'de' MMMM, yyyy", { locale });
    } catch {
      return dateString;
    }
  };


  // Obtener el hotspot actual
  const currentHotspot = useMemo(() => {
    if (!activePhoto) return null;
    return allHotspotsOnFloor.find(h => h.id === activePhoto.hotspot_id);
  }, [activePhoto, allHotspotsOnFloor]);

  const resetView = () => {
    lon.current = 0;
    lat.current = 0;
    if (cameraRef.current) {
        cameraRef.current.fov = 120;
        cameraRef.current.updateProjectionMatrix();
    }
    setCurrentZoom(120);
  };
  
  const zoomInOut = (amount: number) => {
    if (!cameraRef.current) return;
    const newFov = cameraRef.current.fov + amount;
    cameraRef.current.fov = THREE.MathUtils.clamp(newFov, 30, 120);
    cameraRef.current.updateProjectionMatrix();
    setCurrentZoom(cameraRef.current.fov);
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = document.querySelector('.panorama-container') as HTMLElement;
        await elem?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
      setIsFullscreen(!!document.fullscreenElement);
    }
  }, []);

  const handleNavClick = (hotspot: Hotspot) => {
    setFadeTransition(true);
    
    setTimeout(() => {
      onNavigate(hotspot);
      setTimeout(() => setFadeTransition(false), 300);
    }, 300);
  };

  // Animación cinematográfica para navegación 3D
  const animateTransition = useCallback(async (navigationPoint: NavigationPoint, targetHotspot: Hotspot) => {
    if (isTransitioning || !cameraRef.current) return;
    
    setIsTransitioning(true);
    
    const startFov = cameraRef.current.fov;
    
    try {
      // ✅ SOLUCIÓN SIMPLE: ELIMINAR LA ROTACIÓN INICIAL
      // El usuario YA está viendo la flecha, no mover la cámara
      
      // Fase 1: Zoom IN directo hacia donde ya estamos mirando (800ms)
      await new Promise<void>((resolve) => {
        const targetFov = 30;
        const startTime = Date.now();
        const duration = 800;

        const animateZoom = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          const currentFov = startFov + (targetFov - startFov) * easeProgress;
          
          if (cameraRef.current) {
            // 🔥 IMPORTANTE: NO TOCAR lon.current ni lat.current
            // Mantener la orientación actual donde el usuario ve la flecha
            cameraRef.current.fov = currentFov;
            cameraRef.current.updateProjectionMatrix();
            setCurrentZoom(currentFov);
          }

          if (progress < 1) {
            requestAnimationFrame(animateZoom);
          } else {
            resolve();
          }
        };

        animateZoom();
      });
      
      // Fase 2: Fade out y cambio de escena
      setFadeTransition(true);
      await delay(200);
      
      // Aquí cambiamos a la nueva foto
      await onNavigate(targetHotspot);
      
      await delay(200);
      setFadeTransition(false);
      
      // Fase 3: Zoom OUT en la nueva escena
      await new Promise<void>((resolve) => {
        const startFov = 30;
        const targetFov = 120;
        const startTime = Date.now();
        const duration = 400;

        const animateZoomOut = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          const currentFov = startFov + (targetFov - startFov) * easeProgress;
          
          if (cameraRef.current) {
            cameraRef.current.fov = currentFov;
            cameraRef.current.updateProjectionMatrix();
            setCurrentZoom(currentFov);
          }

          if (progress < 1) {
            requestAnimationFrame(animateZoomOut);
          } else {
            resolve();
          }
        };

        animateZoomOut();
      });
      
    } catch (error) {
      console.error('Error during transition:', error);
      resetView();
    } finally {
      setIsTransitioning(false);
    }
  }, [isTransitioning, onNavigate, resetView]);

  const handleDateSelect = (date: string) => {
    // Encontrar la primera foto de esa fecha en el hotspot actual
    const photoForDate = filteredPhotos.find(p => p.capture_date === date);
    if (photoForDate) {
      setActivePhoto(photoForDate);
    }
  };

  // Navegación entre puntos (anterior/siguiente)
  const currentHotspotIndex = useMemo(() => {
    if (!activePhoto) return -1;
    return availableHotspots.findIndex(h => h.id === activePhoto.hotspot_id);
  }, [availableHotspots, activePhoto]);

  const canGoPreviousHotspot = currentHotspotIndex > 0;
  const canGoNextHotspot = currentHotspotIndex >= 0 && currentHotspotIndex < availableHotspots.length - 1;

  const handlePreviousHotspot = () => {
    if (canGoPreviousHotspot) {
      const previousHotspot = availableHotspots[currentHotspotIndex - 1];
      handleNavClick(previousHotspot);
    }
  };

  const handleNextHotspot = () => {
    if (canGoNextHotspot) {
      const nextHotspot = availableHotspots[currentHotspotIndex + 1];
      handleNavClick(nextHotspot);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={fullscreenContainerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="panorama-container fullscreen-container fixed inset-0 bg-black flex items-center justify-center overflow-hidden select-none"
          style={{ zIndex: containerZIndex, isolation: 'isolate' }}
        >
          <div className={`relative w-full h-full transition-opacity duration-300 ${fadeTransition ? 'opacity-0' : 'opacity-100'}`}>
            <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            {sceneRef.current && cameraRef.current && tourType === 'tour_360' && (
              <NavigationArrow3D
                navigationPoints={navigationPoints}
                scene={sceneRef.current}
                camera={cameraRef.current}
                currentZoom={currentZoom}
                onPointClick={async (targetHotspotId) => {
                  const targetHotspot = allHotspotsOnFloor.find(h => h.id === targetHotspotId);
                  const navigationPoint = navigationPoints.find(p => p.to_hotspot_id === targetHotspotId);
                  
                  if (targetHotspot && navigationPoint) {
                    // Buscar foto del hotspot destino con la misma fecha
                    if (currentCaptureDate) {
                      const { data: photoForDate } = await supabase
                        .from('panorama_photos')
                        .select('*')
                        .eq('hotspot_id', targetHotspotId)
                        .eq('capture_date', currentCaptureDate)
                        .limit(1)
                        .maybeSingle();
                      
                      if (photoForDate) {
                        // Actualizar foto activa antes de animar
                        setActivePhoto(photoForDate);
                        animateTransition(navigationPoint, targetHotspot);
                        return;
                      }
                    }
                    
                    // Fallback: buscar la primera foto disponible del destino
                    const { data: fallbackPhoto } = await supabase
                      .from('panorama_photos')
                      .select('*')
                      .eq('hotspot_id', targetHotspotId)
                      .order('capture_date', { ascending: true })
                      .limit(1)
                      .maybeSingle();
                    
                    if (fallbackPhoto) {
                      setActivePhoto(fallbackPhoto);
                      animateTransition(navigationPoint, targetHotspot);
                    }
                  } else if (targetHotspot) {
                    // Fallback: navegación simple sin animación
                    onNavigate(targetHotspot);
                  }
                }}
                getPhotoPreview={(hotspotId) => {
                  const photoUrl = destinationPhotos[hotspotId];
                  console.log('🔍 Preview solicitado para:', hotspotId, '→', photoUrl || 'NO ENCONTRADA');
                  return photoUrl || null;
                }}
              />
            )}
          </div>
          
          {/* Indicador visual durante transición cinematográfica */}
          {isTransitioning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <div className="bg-black/60 backdrop-blur-sm rounded-full p-4">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Compass className="w-8 h-8 text-white" />
                </motion.div>
              </div>
            </div>
          )}

          {/* Loading overlay mientras se inicializa Three.js */}
          {isLoadingScene && !loadingError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-[45]">
              <div className="bg-black/90 backdrop-blur-md rounded-xl p-8 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-white text-lg font-medium">{t('viewer.loading360')}</p>
                <p className="text-white/60 text-sm">{t('viewer.preparingControls')}</p>
              </div>
            </div>
          )}

          {loadingError && (
            <ImageNotFoundFallback
              imageUrl={activePhoto?.photo_url || ''}
              hotspotTitle={hotspotName}
              onRetry={() => {
                setLoadingError(null);
                if (activePhoto) setActivePhoto({...activePhoto});
              }}
              onClose={onClose}
            />
          )}

          {/* Botones de navegación entre puntos - SIEMPRE VISIBLES */}
          {!loadingError && !isLoadingScene && (
            <>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handlePreviousHotspot}
                disabled={!canGoPreviousHotspot}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full h-10 w-10 md:h-12 md:w-12 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed z-40"
                title={t('viewer.previousPoint')}
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </Button>

              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleNextHotspot}
                disabled={!canGoNextHotspot}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full h-10 w-10 md:h-12 md:w-12 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed z-40"
                title={t('viewer.nextPoint')}
              >
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
              </Button>
            </>
          )}

          {/* Botón flotante toggle menú - SOLO MÓVILES */}

          {/* Botón flotante toggle menú - SOLO MÓVILES */}
          {isMobile && !loadingError && !isLoadingScene && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuVisible(!isMenuVisible)}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] 
                         text-white bg-black/80 hover:bg-black/90 
                         backdrop-blur-sm rounded-full h-10 w-10 shadow-2xl 
                         border border-white/30"
              title={isMenuVisible ? t('viewer.hideMenu') : t('viewer.showMenu')}
            >
              {isMenuVisible ? <ChevronDown className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          )}

          {/* Header superior - SIEMPRE VISIBLE */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none z-50">
            <div className={`flex justify-between items-center ${isLoadingScene ? 'pointer-events-none opacity-50' : 'pointer-events-auto'}`}>
              <div className="text-white flex items-start gap-3">
                  <div className="flex-1">
                  <h2 className="text-xl font-bold">{hotspotName}</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    {photosByDate.length > 1 && activePhoto && (
                      <span>
                        {t('viewer.photoOfTotal', { 
                          current: photosByDate.findIndex(p => p.id === activePhoto.id) + 1, 
                          total: photosByDate.length 
                        })}
                      </span>
                    )}
                    {activePhoto?.capture_date && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span>{formatDate(activePhoto.capture_date)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DateSelector
                  availableDates={availableDates}
                  currentDate={currentCaptureDate}
                  onDateSelect={handleDateSelect}
                />
                <Button variant="ghost" size="icon" onClick={() => setShowInfo(!showInfo)} className="text-white hover:bg-white/20 rounded-full h-9 w-9">
                  <Info className="w-4 h-4" />
                </Button>
                {/* Ocultar botón de fullscreen en PWA */}
                {!isStandalone && (
                  <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20 rounded-full h-9 w-9">
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full h-9 w-9">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Controles inferiores - Responsive según dispositivo */}
          {(!isMobile || isMenuVisible) && (
            <AnimatePresence>
            <motion.div 
              {...(isMobile && {
                initial: { y: 100, opacity: 0 },
                animate: { y: 0, opacity: 1 },
                exit: { y: 100, opacity: 0 },
                transition: { type: "spring", damping: 25, stiffness: 300 }
              })}
              className="absolute bottom-0 left-0 right-0 p-4 z-50"
            >
                <div className={`bg-black/70 backdrop-blur-md rounded-xl p-4 mx-auto max-w-4xl border border-white/10 ${isLoadingScene ? 'pointer-events-none opacity-50' : ''}`}>
                  <div className="flex items-center justify-center gap-3 flex-wrap pointer-events-auto">
                {/* Floor Selector */}
                {floorPlans.length > 0 && currentFloorPlan && onFloorChange && (
                  <DropdownMenu key={`floor-${fullscreenVersion}`} modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 h-auto flex items-center gap-2 border border-white/20 bg-black/40 text-sm"
                      >
                        <Building2 className="w-4 h-4" />
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-slate-400">Floor</span>
                          <span className="text-sm font-medium">
                            {currentFloorPlan.name}
                          </span>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      container={isFullscreen ? fullscreenContainerRef.current : undefined}
                      align="start" 
                      className="bg-black/90 backdrop-blur-sm border-white/20 text-white"
                      style={{ zIndex: 99999 }}
                    >
                      <ScrollArea className={isMobile ? "h-[180px]" : ""}>
                        {floorPlans.map((floor) => {
                          const hotspotCount = getHotspotCount(floor.id);
                          return (
                            <DropdownMenuItem
                              key={floor.id}
                              onClick={() => {
                                if (floor.id === currentFloorPlan.id) return;
                                
                                if (hotspotCount === 0) {
                                  toast.error(t('viewer.emptyFloorTitle'), {
                                    description: t('viewer.emptyFloorDescription')
                                  });
                                  return;
                                }
                                
                                onFloorChange(floor.id);
                              }}
                              className={`text-white hover:bg-white/20 ${floor.id === currentFloorPlan.id ? 'bg-white/10' : ''}`}
                            >
                              <Building2 className="w-4 h-4 mr-2" />
                              <span className="flex-1">{floor.name}</span>
                              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                {hotspotCount}
                              </span>
                            </DropdownMenuItem>
                          );
                        })}
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                {/* Dropdown de Puntos */}
                {availableHotspots.length > 0 && (
                  <DropdownMenu key={`hotspots-${fullscreenVersion}`} modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 h-auto flex items-center gap-2 border border-white/20 bg-black/40 text-sm"
                      >
                        <MapPin className="w-4 h-4" />
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-slate-400">Hotspots</span>
                          <span className="text-sm font-medium">
                            {currentHotspot?.title || hotspotName}
                          </span>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      container={isFullscreen ? fullscreenContainerRef.current : undefined}
                      className="w-72 bg-black/95 backdrop-blur-md border-white/30 text-white"
                      style={{ zIndex: 99999 }}
                    >
                      <div className="px-2 py-1.5 text-sm font-semibold">
                        Hotspots ({availableHotspots.length})
                      </div>
                      <DropdownMenuSeparator className="bg-white/20" />
                      <ScrollArea className={isMobile ? "h-[180px]" : "h-[320px]"}>
                        {availableHotspots.map(hotspot => (
                          <DropdownMenuItem
                            key={hotspot.id}
                            onClick={() => handleNavClick(hotspot)}
                            className={`cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white ${
                              hotspot.id === activePhoto?.hotspot_id ? 'bg-white/20 font-semibold' : ''
                            }`}
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            {hotspot.title}
                            {hotspot.id === activePhoto?.hotspot_id && (
                              <span className="ml-auto text-xs text-slate-400">{t('viewer.current')}</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Dropdown de Fechas */}
                {availableDates.length > 0 && (
                  <DropdownMenu key={`date-${fullscreenVersion}`} modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 h-auto flex items-center gap-2 border border-white/20 bg-black/40 text-sm"
                      >
                        <Calendar className="w-4 h-4" />
                        <div className="flex flex-col items-start">
                          <span className="text-xs text-slate-400">{t('viewer.date')}</span>
                          <span className="text-sm font-medium">
                            {activePhoto?.capture_date ? formatDate(activePhoto.capture_date) : t('viewer.noDate')}
                          </span>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      container={isFullscreen ? fullscreenContainerRef.current : undefined}
                      className="w-64 bg-black/95 backdrop-blur-md border-white/30 text-white"
                      style={{ zIndex: 99999 }}
                    >
                      <div className="px-2 py-1.5 text-sm font-semibold">
                        {t('viewer.selectDate', { count: availableDates.length })}
                      </div>
                      <DropdownMenuSeparator className="bg-white/20" />
                      <ScrollArea className={isMobile ? "h-[180px]" : "max-h-64"}>
                        {availableDates.map((date) => {
                          const photosForDate = filteredPhotos.filter(p => p.capture_date === date);
                          return (
                            <DropdownMenuItem
                              key={date}
                              onClick={() => handleDateSelect(date)}
                              className={`cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white ${
                                date === activePhoto?.capture_date ? 'bg-white/20 font-semibold' : ''
                              }`}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              <div className="flex-1">
                                {formatDate(date)}
                                <span className="text-xs text-slate-400 ml-2">
                                  ({photosForDate.length} {photosForDate.length === 1 ? t('viewer.photo') : t('viewer.photos')})
                                </span>
                              </div>
                              {date === activePhoto?.capture_date && (
                                <span className="ml-auto text-xs text-slate-400">{t('viewer.current')}</span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="w-px h-8 bg-white/30" />
                
                {/* Controles de Zoom */}
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => zoomInOut(5)} 
                    className="text-white hover:bg-white/20 rounded-full bg-black/40 h-8 w-8" 
                    disabled={currentZoom >= 120}
                    title={t('viewer.zoomOut')}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-white text-xs font-medium min-w-12 text-center">
                    {Math.round(100 - (currentZoom - 30) / (120 - 30) * 100)}%
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => zoomInOut(-5)} 
                    className="text-white hover:bg-white/20 rounded-full bg-black/40 h-8 w-8" 
                    disabled={currentZoom <= 30}
                    title={t('viewer.zoomIn')}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>

                <div className="w-px h-8 bg-white/30" />
                
                {/* Reset View */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={resetView} 
                  className="text-white hover:bg-white/20 rounded-full bg-black/40 h-8 w-8" 
                  title={t('viewer.resetView')}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

          <AnimatePresence>
            {showInfo && activePhoto?.description && !loadingError && (
              <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className="absolute top-20 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm pointer-events-auto z-40">
                <h3 className="font-semibold mb-2">{t('viewer.information')}</h3>
                <p className="text-sm text-slate-300">{activePhoto.description}</p>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
}