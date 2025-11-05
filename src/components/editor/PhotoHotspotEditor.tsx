import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { convertContainerToImageCoordinates, convertImageToContainerPosition } from '@/components/shared/ImageCoordinateCalculator';
import * as LucideIcons from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Hotspot } from '@/types/tour';
import { useUnifiedPointer } from '@/hooks/useUnifiedPointer';
import { supabase } from '@/integrations/supabase/client';
import { PlacementLoadingOverlay } from './PlacementLoadingOverlay';

const extractFilename = (url: string): string => {
  try {
    const parts = url.split('/');
    return parts[parts.length - 1];
  } catch {
    return 'unknown';
  }
};

interface PhotoHotspotEditorProps {
  imageUrl: string;
  hotspots: Hotspot[];
  selectedIds: string[];
  onHotspotClick: (id: string, event: React.MouseEvent) => void;
  onHotspotDrag: (id: string, x: number, y: number) => void;
  onCanvasClick: (x: number, y: number) => void;
  readOnly?: boolean;
  selectMode?: boolean;
  moveMode?: boolean;
  isPlacingPoint?: boolean;
  placementProgress?: number;
  currentPointIndex?: number;
  totalPoints?: number;
}

export default function PhotoHotspotEditor({
  imageUrl,
  hotspots,
  selectedIds,
  onHotspotClick,
  onHotspotDrag,
  onCanvasClick,
  readOnly = false,
  selectMode = false,
  moveMode = false,
  isPlacingPoint = false,
  placementProgress = 0,
  currentPointIndex = 0,
  totalPoints = 0,
}: PhotoHotspotEditorProps) {
  const { t } = useTranslation();
  const { getEventCoordinates, preventDefault } = useUnifiedPointer();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [debugClickPoint, setDebugClickPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [photosData, setPhotosData] = useState<Record<string, { count: number; names: string[] }>>({});

  useEffect(() => {
    const loadPhotos = async () => {
      if (hotspots.length === 0) return;

      const hotspotIds = hotspots.map(h => h.id);
      
      try {
        const { data, error } = await supabase
          .from('panorama_photos')
          .select('hotspot_id, photo_url, original_filename')
          .in('hotspot_id', hotspotIds)
          .order('display_order', { ascending: true });

        if (error) throw error;

        const grouped: Record<string, { count: number; names: string[] }> = {};
        
        data?.forEach(photo => {
          if (!grouped[photo.hotspot_id]) {
            grouped[photo.hotspot_id] = { count: 0, names: [] };
          }
          grouped[photo.hotspot_id].count++;
          const filename = photo.original_filename || extractFilename(photo.photo_url);
          grouped[photo.hotspot_id].names.push(filename);
        });

        setPhotosData(grouped);
      } catch (error) {
        console.error('Error loading photos:', error);
      }
    };

    loadPhotos();
  }, [hotspots]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (readOnly || draggingId) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-hotspot]')) return;

    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    preventDefault(e);

    const coords = getEventCoordinates(e);
    const imageCoords = convertContainerToImageCoordinates(
      coords.clientX,
      coords.clientY,
      container,
      image
    );

    if (imageCoords) {
      console.group('🎯 Debug de Coordenadas');
      console.log('Click/Tap en:', coords);
      console.log('Imagen rect:', image.getBoundingClientRect());
      console.log('Coordenadas %:', imageCoords);
      console.groupEnd();
      
      setDebugClickPoint({ x: coords.clientX, y: coords.clientY });
      setTimeout(() => setDebugClickPoint(null), 2000);
      
      onCanvasClick(imageCoords.x, imageCoords.y);
    }
  };

  const handleHotspotPointerDown = (hotspot: Hotspot, e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    
    preventDefault(e);
    e.stopPropagation();
    
    const coords = getEventCoordinates(e);
    setDraggingId(hotspot.id);
    setDragStart({ x: coords.clientX, y: coords.clientY });
    setShowCoordinates(true);
    
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingId || readOnly) return;

    preventDefault(e);
    
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    const coords = getEventCoordinates(e);
    const imageCoords = convertContainerToImageCoordinates(
      coords.clientX,
      coords.clientY,
      container,
      image
    );

    if (imageCoords) {
      setDragPosition({ x: imageCoords.x, y: imageCoords.y });
      onHotspotDrag(draggingId, imageCoords.x, imageCoords.y);
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDragStart(null);
    setDragPosition(null);
    setShowCoordinates(false);
    
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  useEffect(() => {
    if (draggingId) {
      document.addEventListener('mouseup', handleMouseUp as any);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp as any);
      };
    }
  }, [draggingId]);

  const renderHotspotIcon = (hotspot: Hotspot) => {
    const iconName = hotspot.style?.icon || 'MapPin';
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.MapPin;
    const isSelected = selectedIds.includes(hotspot.id);
    
    return (
      <div className="relative w-full h-full">
        {isSelected && (
          <div className="absolute inset-0 rounded-full bg-[#4285F4] animate-ping opacity-25" />
        )}
        
        <div 
          className="relative w-full h-full rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-all"
          style={{ 
            backgroundColor: hotspot.style?.color || '#4285F4',
            boxShadow: isSelected ? '0 0 0 4px rgba(66, 133, 244, 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        >
          <IconComponent 
            className="w-1/2 h-1/2 text-white" 
          />
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6 bg-[hsl(var(--accent)/0.3)]">
      <div className="relative">
        <div
          ref={containerRef}
          className={`relative bg-background rounded-lg overflow-hidden border-2 border-dashed border-border shadow-inner ${
            readOnly 
              ? 'cursor-default' 
              : selectMode 
                ? 'cursor-pointer' 
                : moveMode 
                  ? 'cursor-move' 
                  : 'cursor-crosshair'
          }`}
          onClick={handleCanvasClick as any}
          onTouchStart={handleCanvasClick as any}
          onMouseMove={handleMouseMove as any}
          onTouchMove={handleMouseMove as any}
          style={{ maxHeight: '80vh' }}
        >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Floor plan"
          className="w-full h-auto select-none"
          draggable={false}
        />

        {debugClickPoint && (
          <div
            className="absolute w-3 h-3 bg-red-500 rounded-full pointer-events-none z-[9999] animate-ping"
            style={{
              left: `${debugClickPoint.x}px`,
              top: `${debugClickPoint.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}

        {draggingId && dragPosition && showCoordinates && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg pointer-events-none z-[9999] backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-xs font-mono">
              <span className="text-green-400">X:</span> {dragPosition.x.toFixed(2)}% 
              <span className="mx-2">•</span>
              <span className="text-blue-400">Y:</span> {dragPosition.y.toFixed(2)}%
            </div>
          </div>
        )}

        {hotspots.map((hotspot) => {
          const container = containerRef.current;
          const image = imageRef.current;
          if (!container || !image) return null;

          const position = convertImageToContainerPosition(
            hotspot.x_position,
            hotspot.y_position,
            container,
            image
          );

          const size = hotspot.style?.size || 32;
          const isSelected = selectedIds.includes(hotspot.id);
          const isDragging = draggingId === hotspot.id;
          const photoInfo = photosData[hotspot.id] || { count: 0, names: [] };

          return (
            <div
              key={hotspot.id}
              data-hotspot
              className={`group absolute ${
                isDragging 
                  ? 'cursor-grabbing scale-125 shadow-2xl transition-transform duration-100' 
                  : moveMode
                    ? 'cursor-move hover:scale-110 transition-all duration-200'
                    : selectMode
                      ? 'cursor-pointer hover:scale-110 hover:ring-2 hover:ring-primary transition-all duration-200'
                      : 'cursor-grab hover:scale-110 transition-all duration-200'
              } ${isSelected ? 'ring-4 ring-primary ring-opacity-50 rounded-full' : ''}`}
              style={{
                left: position.left,
                top: position.top,
                width: `${size}px`,
                height: `${size}px`,
                padding: '8px',
                transform: 'translate(-50%, -50%)',
                zIndex: isDragging ? 1000 : isSelected ? 100 : 10,
                opacity: isDragging ? 0.9 : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onHotspotClick(hotspot.id, e);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleHotspotPointerDown(hotspot, e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleHotspotPointerDown(hotspot, e);
              }}
            >
              {renderHotspotIcon(hotspot)}
              
              <div className="absolute bottom-full mb-2 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                <div className="bg-card border border-border px-3 py-2 rounded-lg shadow-lg min-w-[200px]">
                  <p className="text-sm font-medium text-foreground mb-1">{hotspot.title}</p>
                  {photoInfo.count > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-1 mt-1">
                      <p className="font-medium">📸 {photoInfo.count} {photoInfo.count === 1 ? 'foto' : 'fotos'}:</p>
                      <ul className="space-y-0.5 pl-2">
                        {photoInfo.names.slice(0, 3).map((name, idx) => (
                          <li key={idx} className="truncate max-w-[180px]">• {name}</li>
                        ))}
                        {photoInfo.count > 3 && (
                          <li className="text-muted-foreground/70">...y {photoInfo.count - 3} más</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>

        <PlacementLoadingOverlay 
          isVisible={isPlacingPoint}
          progress={placementProgress}
          currentPoint={currentPointIndex}
          totalPoints={totalPoints}
        />
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-center">
        {readOnly ? (
          <>
            <span className="font-semibold">{t('editor.activeMode')}:</span> {t('editorMode.clickToEdit')}
          </>
        ) : (
          <>
            <span className="font-semibold text-primary">{t('editorMode.addMode')}</span> {t('editorMode.clickToAdd')}
          </>
        )}
      </p>
    </Card>
  );
}
