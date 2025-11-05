import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NavigationPoint } from '@/types/tour';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, ImageIcon } from 'lucide-react';
import { useSphericalCoordinates } from '@/hooks/useSphericalCoordinates';
import { ArrowPlacementControls2D } from './ArrowPlacementControls2D';

interface NavigationArrowPlacementEditor2DProps {
  hotspotId: string;
  panoramaUrl: string;
  existingPoints: NavigationPoint[];
  availableTargets: Array<{ id: string; title: string }>;
  currentCaptureDate: string | null;
  onSave?: () => void;
  onToggle3D?: () => void;
}

type Mode = 'view' | 'place' | 'drag';

interface Point {
  id: string;
  x: number;
  y: number;
  u: number;
  v: number;
  theta: number;
  phi: number;
  label?: string;
  to_hotspot_id: string;
}

export function NavigationArrowPlacementEditor2D({
  hotspotId,
  panoramaUrl,
  existingPoints,
  availableTargets,
  currentCaptureDate,
  onSave,
  onToggle3D
}: NavigationArrowPlacementEditor2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [mode, setMode] = useState<Mode>('view');
  const [targetHotspot, setTargetHotspot] = useState<string>('');
  const [points, setPoints] = useState<Point[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<Point | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(100);
  
  const { uvToSpherical } = useSphericalCoordinates();

  // Cargar imagen y puntos
  useEffect(() => {
    console.log('[2D Editor] Cargando panorama:', panoramaUrl);
    setIsLoadingImage(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('[2D Editor] ✅ Imagen cargada:', img.width, 'x', img.height);
      imageRef.current = img;
      setIsLoadingImage(false);
      drawCanvas();
    };
    img.onerror = (e) => {
      console.error('[2D Editor] ❌ Error cargando imagen:', e);
      setIsLoadingImage(false);
      toast.error('Error al cargar la imagen panorámica');
    };
    img.src = panoramaUrl;
  }, [panoramaUrl]);

  // Convertir puntos existentes a formato del canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const convertedPoints: Point[] = existingPoints.map(p => {
      const u = p.u ?? 0.5;
      const v = p.v ?? 0.5;
      return {
        id: p.id,
        x: u * canvas.width,
        y: v * canvas.height,
        u,
        v,
        theta: p.theta,
        phi: p.phi,
        label: p.label || p.target_hotspot?.title,
        to_hotspot_id: p.to_hotspot_id
      };
    });
    setPoints(convertedPoints);
  }, [existingPoints]);

  // Redibujar cuando cambien puntos o imagen
  useEffect(() => {
    drawCanvas();
  }, [points, selectedPoint, hoveredPoint, showGrid, zoom]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const image = imageRef.current;

    console.log('[2D Editor] drawCanvas llamado', { 
      hasCanvas: !!canvas, 
      hasCtx: !!ctx, 
      hasImage: !!image,
      imageSize: image ? `${image.width}x${image.height}` : 'N/A'
    });

    if (!canvas || !ctx || !image) return;

    // Ajustar tamaño del canvas
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth * (zoom / 100);
      canvas.height = (container.clientWidth * (zoom / 100)) / 2; // Ratio 2:1 para equirectangular
    }

    // ✅ Dibujar imagen sin inversión (vista natural)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Dibujar grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      // Líneas verticales
      for (let i = 0; i <= 12; i++) {
        const x = (i / 12) * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Líneas horizontales
      for (let i = 0; i <= 6; i++) {
        const y = (i / 6) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Actualizar posiciones de puntos si cambió el zoom
    const updatedPoints = points.map(p => ({
      ...p,
      x: p.u * canvas.width,
      y: p.v * canvas.height
    }));

    // Dibujar puntos
    updatedPoints.forEach(point => {
      const isSelected = selectedPoint?.id === point.id;
      const isHovered = hoveredPoint?.id === point.id;
      
      // Flecha
      ctx.fillStyle = isSelected ? '#22c55e' : isHovered ? '#3b82f6' : '#6366f1';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      
      // Círculo
      ctx.beginPath();
      ctx.arc(point.x, point.y, isSelected || isHovered ? 12 : 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Flecha direccional (triángulo)
      const size = isSelected || isHovered ? 8 : 6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size);
      ctx.lineTo(point.x - size * 0.6, point.y + size * 0.4);
      ctx.lineTo(point.x + size * 0.6, point.y + size * 0.4);
      ctx.closePath();
      ctx.fill();
      
      // Label
      if (point.label) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.font = 'bold 12px sans-serif';
        ctx.strokeText(point.label, point.x + 16, point.y + 4);
        ctx.fillText(point.label, point.x + 16, point.y + 4);
      }
    });
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Escalar coordenadas al tamaño real del canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    // Verificar si se clickeó un punto existente
    const clickedPoint = points.find(p => {
      const dx = p.x - canvasX;
      const dy = p.y - canvasY;
      return Math.sqrt(dx * dx + dy * dy) < 12;
    });

    if (clickedPoint) {
      if (mode === 'drag') {
        setDraggedPoint(clickedPoint);
      }
      setSelectedPoint(clickedPoint);
      return;
    }

    // Modo colocar
    if (mode === 'place' && targetHotspot) {
      const u = canvasX / canvas.width;
      const v = canvasY / canvas.height;
      
      if (u < 0 || u > 1 || v < 0 || v > 1) {
        toast.error('Coordenadas fuera de rango');
        return;
      }

      const spherical = uvToSpherical({ u, v });
      await placeArrow(u, v, spherical.theta, spherical.phi);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    // Detectar hover
    const hovered = points.find(p => {
      const dx = p.x - canvasX;
      const dy = p.y - canvasY;
      return Math.sqrt(dx * dx + dy * dy) < 12;
    });
    setHoveredPoint(hovered || null);

    // Arrastrar punto
    if (draggedPoint && mode === 'drag') {
      const u = canvasX / canvas.width;
      const v = canvasY / canvas.height;
      
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        setPoints(prev => prev.map(p => 
          p.id === draggedPoint.id 
            ? { ...p, x: canvasX, y: canvasY, u, v }
            : p
        ));
        setSelectedPoint(prev => prev?.id === draggedPoint.id ? { ...prev, x: canvasX, y: canvasY, u, v } : prev);
      }
    }
  };

  const handleMouseUp = async () => {
    if (draggedPoint && mode === 'drag') {
      const point = points.find(p => p.id === draggedPoint.id);
      if (point) {
        const spherical = uvToSpherical({ u: point.u, v: point.v });
        await updateArrowPosition(point.id, point.u, point.v, spherical.theta, spherical.phi);
      }
      setDraggedPoint(null);
    }
  };

  const placeArrow = async (u: number, v: number, theta: number, phi: number) => {
    if (!targetHotspot) {
      toast.error('Selecciona un destino');
      return;
    }

    if (!currentCaptureDate) {
      toast.error('No hay fecha seleccionada');
      return;
    }

    setLoading(true);
    try {
      const target = availableTargets.find(t => t.id === targetHotspot);
      
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .insert({
          from_hotspot_id: hotspotId,
          to_hotspot_id: targetHotspot,
          u,
          v,
          theta,
          phi,
          capture_date: currentCaptureDate,
          label: target?.title,
          is_active: true
        });

      if (error) throw error;

      toast.success(`✅ Flecha colocada para ${currentCaptureDate}`);
      onSave?.();
      setMode('view');
      setTargetHotspot('');
    } catch (error) {
      console.error('Error placing arrow:', error);
      toast.error('Error al colocar flecha');
    } finally {
      setLoading(false);
    }
  };

  const updateArrowPosition = async (id: string, u: number, v: number, theta: number, phi: number) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .update({ u, v, theta, phi })
        .eq('id', id);

      if (error) throw error;

      toast.success('✅ Posición actualizada (UV)');
      onSave?.();
    } catch (error) {
      console.error('Error updating arrow:', error);
      toast.error('Error al actualizar posición');
    } finally {
      setLoading(false);
    }
  };

  const deleteArrow = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Flecha eliminada');
      setSelectedPoint(null);
      onSave?.();
    } catch (error) {
      console.error('Error deleting arrow:', error);
      toast.error('Error al eliminar flecha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4">
      {/* Canvas Editor */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              <h3 className="text-sm font-semibold">Editor 2D - Vista Equirectangular</h3>
            </div>
            {onToggle3D && (
              <Button size="sm" variant="outline" onClick={onToggle3D}>
                <Eye className="w-4 h-4 mr-1" />
                Preview 3D
              </Button>
            )}
          </div>

          <div 
            ref={containerRef}
            className="relative border rounded-lg overflow-auto bg-black"
            style={{ maxHeight: '600px' }}
          >
            {isLoadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-muted-foreground">Cargando imagen panorámica...</p>
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              width={800}
              height={400}
              className="border-2 border-primary/30 rounded"
              style={{ 
                cursor: mode === 'place' ? 'crosshair' : mode === 'drag' ? 'move' : 'default',
                backgroundColor: 'hsl(var(--muted))'
              }}
            />
          </div>

          {selectedPoint && (
            <div className="mt-3 p-2 bg-muted rounded-lg text-xs space-y-1">
              <div className="font-semibold">{selectedPoint.label || 'Flecha seleccionada'}</div>
              <div className="text-muted-foreground">
                UV: ({selectedPoint.u.toFixed(3)}, {selectedPoint.v.toFixed(3)})
              </div>
              <div className="text-muted-foreground">
                Esférico: θ={selectedPoint.theta.toFixed(0)}°, φ={selectedPoint.phi.toFixed(0)}°
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controles */}
      <ArrowPlacementControls2D
        mode={mode}
        onModeChange={setMode}
        targetHotspot={targetHotspot}
        onTargetChange={setTargetHotspot}
        availableTargets={availableTargets}
        existingPoints={points}
        onDeletePoint={deleteArrow}
        selectedPoint={selectedPoint}
        onSelectPoint={(point: any) => setSelectedPoint(point)}
        disabled={loading}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        zoom={zoom}
        onZoomChange={setZoom}
      />
    </div>
  );
}
