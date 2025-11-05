import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, X, Sparkles, Eye, List } from 'lucide-react';
import { Hotspot, NavigationPoint } from '@/types/tour';
import { NavigationArrowPlacementEditor } from './NavigationArrowPlacementEditor';

interface NavigationPointsEditorProps {
  hotspot: Hotspot;
  allHotspots: Hotspot[];
  onSave?: () => void;
}

export const NavigationPointsEditor = ({
  hotspot,
  allHotspots,
  onSave
}: NavigationPointsEditorProps) => {
  const [points, setPoints] = useState<NavigationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, { theta: number; phi: number }>>({});
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [editMode, setEditMode] = useState<'list' | 'visual'>('list');
  const [firstPanorama, setFirstPanorama] = useState<string | null>(null);
  
  useEffect(() => {
    loadNavigationPoints();
  }, [hotspot.id]);
  
  // Cargar primera foto panorámica del hotspot
  useEffect(() => {
    const loadPanorama = async () => {
      const { data } = await supabase
        .from('panorama_photos')
        .select('photo_url')
        .eq('hotspot_id', hotspot.id)
        .order('display_order')
        .limit(1)
        .single();
      
      if (data) setFirstPanorama(data.photo_url);
    };
    loadPanorama();
  }, [hotspot.id]);
  
  const loadNavigationPoints = async () => {
    const { data, error } = await supabase
      .from('hotspot_navigation_points')
      .select(`
        *,
        target_hotspot:to_hotspot_id(*)
      `)
      .eq('from_hotspot_id', hotspot.id)
      .order('display_order');
    
    if (error) {
      console.error('Error loading navigation points:', error);
      return;
    }
    
    if (data) setPoints(data as any);
  };
  
  const addNavigationPoint = async (toHotspotId: string) => {
    const toHotspot = allHotspots.find(h => h.id === toHotspotId);
    if (!toHotspot) return;
    
    // Calcular theta aproximado basándose en posiciones en floor plan
    const dx = toHotspot.x_position - hotspot.x_position;
    const dy = toHotspot.y_position - hotspot.y_position;
    const theta = Math.atan2(dx, dy) * (180 / Math.PI);
    
    const { error } = await supabase
      .from('hotspot_navigation_points')
      .insert({
        from_hotspot_id: hotspot.id,
        to_hotspot_id: toHotspotId,
        theta,
        phi: 90, // Horizonte por defecto
        label: `Ir a ${toHotspot.title}`
      });
    
    if (error) {
      toast.error('Error al añadir punto de navegación');
      return;
    }
    
    toast.success('Punto de navegación añadido');
    loadNavigationPoints();
    onSave?.();
  };
  
  const updateNavigationPoint = async (
    pointId: string, 
    updates: Partial<NavigationPoint>
  ) => {
    const { error } = await supabase
      .from('hotspot_navigation_points')
      .update(updates)
      .eq('id', pointId);
    
    if (error) {
      toast.error('Error al actualizar punto');
      return;
    }
    
    loadNavigationPoints();
    onSave?.();
  };

  const debouncedUpdate = useCallback((pointId: string, field: 'theta' | 'phi', value: number) => {
    // Actualizar valor local inmediatamente (para UI responsiva)
    setLocalValues(prev => ({
      ...prev,
      [pointId]: {
        ...prev[pointId],
        [field]: value
      }
    }));

    // Limpiar timeout anterior si existe
    if (debounceTimeouts.current[`${pointId}-${field}`]) {
      clearTimeout(debounceTimeouts.current[`${pointId}-${field}`]);
    }

    // Crear nuevo timeout para actualizar BD
    debounceTimeouts.current[`${pointId}-${field}`] = setTimeout(() => {
      updateNavigationPoint(pointId, { [field]: value });
      delete debounceTimeouts.current[`${pointId}-${field}`];
    }, 500);
  }, []);
  
  const deleteNavigationPoint = async (pointId: string) => {
    const { error } = await supabase
      .from('hotspot_navigation_points')
      .delete()
      .eq('id', pointId);
    
    if (error) {
      toast.error('Error al eliminar punto');
      return;
    }
    
    toast.success('Punto eliminado');
    loadNavigationPoints();
    onSave?.();
  };
  
  const autoDetectConnections = async () => {
    if (!hotspot.floor_plan_id) {
      toast.error('Hotspot sin floor plan asignado');
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('suggest_hotspot_connections', {
        p_floor_plan_id: hotspot.floor_plan_id,
        p_max_distance: 30
      });
      
      if (error) throw error;
      
      if (data) {
        const connectionsForThisHotspot = data.filter((c: any) => c.from_id === hotspot.id);
        
        if (connectionsForThisHotspot.length === 0) {
          toast.info('No se encontraron conexiones cercanas');
          return;
        }
        
        // Crear puntos para las conexiones sugeridas
        let added = 0;
        for (const conn of connectionsForThisHotspot) {
          // Verificar si ya existe
          const exists = points.some(p => p.to_hotspot_id === conn.to_id);
          if (!exists) {
            await addNavigationPoint(conn.to_id);
            added++;
          }
        }
        
        toast.success(`${added} conexiones añadidas automáticamente`);
      }
    } catch (error) {
      console.error('Error auto-detecting connections:', error);
      toast.error('Error al detectar conexiones');
    } finally {
      setLoading(false);
    }
  };
  
  const availableHotspots = allHotspots
    .filter(h => h.id !== hotspot.id && h.has_panorama)
    .filter(h => !points.some(p => p.to_hotspot_id === h.id));
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Puntos de Navegación 3D
            </CardTitle>
            <CardDescription>
              Define hacia dónde pueden navegar los usuarios desde "{hotspot.title}"
            </CardDescription>
          </div>
          
          {/* Botón toggle modo */}
          {firstPanorama && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(prev => prev === 'list' ? 'visual' : 'list')}
            >
              {editMode === 'list' ? (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Editor Visual
                </>
              ) : (
                <>
                  <List className="w-4 h-4 mr-2" />
                  Vista Lista
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editMode === 'list' ? (
          <>
        {/* Lista de puntos existentes */}
        {points.length > 0 && (
          <div className="space-y-3">
            {points.map((point) => (
              <div key={point.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {(point.target_hotspot as any)?.title || 'Destino'}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteNavigationPoint(point.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Sliders para ajustar theta/phi */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Ángulo Horizontal (θ): {(localValues[point.id]?.theta ?? point.theta).toFixed(0)}°
                    </label>
                    <Slider
                      value={[localValues[point.id]?.theta ?? point.theta]}
                      min={-180}
                      max={180}
                      step={5}
                      onValueChange={([theta]) => 
                        debouncedUpdate(point.id, 'theta', theta)
                      }
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-muted-foreground">
                      Ángulo Vertical (φ): {(localValues[point.id]?.phi ?? point.phi).toFixed(0)}°
                    </label>
                    <Slider
                      value={[localValues[point.id]?.phi ?? point.phi]}
                      min={0}
                      max={180}
                      step={5}
                      onValueChange={([phi]) => 
                        debouncedUpdate(point.id, 'phi', phi)
                      }
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {points.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay puntos de navegación configurados</p>
            <p className="text-sm">Añade conexiones manualmente o usa auto-detección</p>
          </div>
        )}
        
        {/* Botones de acción */}
        <div className="flex gap-2">
          {/* Dropdown para añadir nuevo punto */}
          {availableHotspots.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <MapPin className="h-4 w-4 mr-2" />
                  Añadir Punto
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-[300px] overflow-y-auto">
                {availableHotspots.map(h => (
                  <DropdownMenuItem 
                    key={h.id}
                    onClick={() => addNavigationPoint(h.id)}
                  >
                    {h.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Botón de auto-sugerencias */}
          <Button 
            variant="secondary" 
            className="flex-1"
            onClick={autoDetectConnections}
            disabled={loading}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Auto-detectar
          </Button>
        </div>
        
        {availableHotspots.length === 0 && points.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Todos los hotspots disponibles ya están conectados
          </p>
        )}
          </>
        ) : (
          // Nuevo editor visual 3D
          <NavigationArrowPlacementEditor
            hotspotId={hotspot.id}
            panoramaUrl={firstPanorama!}
            existingPoints={points}
            availableTargets={allHotspots
              .filter(h => h.id !== hotspot.id)
              .map(h => ({
                id: h.id,
                title: h.title
              }))}
            onSave={async () => {
              await loadNavigationPoints();
              onSave?.();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
};
