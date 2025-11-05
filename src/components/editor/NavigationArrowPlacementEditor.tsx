import { useState, useEffect } from 'react';
import { NavigationPoint } from '@/types/tour';
import { Button } from '@/components/ui/button';
import { Eye, ImageIcon, Calendar } from 'lucide-react';
import { NavigationArrowPlacementEditor2D } from './NavigationArrowPlacementEditor2D';
import { NavigationArrowPlacementEditor3D } from './NavigationArrowPlacementEditor3D';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface NavigationArrowPlacementEditorProps {
  hotspotId: string;
  panoramaUrl: string;
  existingPoints: NavigationPoint[];
  availableTargets: Array<{ id: string; title: string }>;
  onSave: (points: NavigationPoint[]) => Promise<void>;
}

export const NavigationArrowPlacementEditor = ({
  hotspotId,
  panoramaUrl,
  existingPoints,
  availableTargets,
  onSave
}: NavigationArrowPlacementEditorProps) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [currentCaptureDate, setCurrentCaptureDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [filteredPoints, setFilteredPoints] = useState<NavigationPoint[]>([]);
  const [currentPanoramaUrl, setCurrentPanoramaUrl] = useState<string>(panoramaUrl);

  // Cargar fechas disponibles del hotspot
  useEffect(() => {
    const loadAvailableDates = async () => {
      const { data } = await supabase
        .from('panorama_photos')
        .select('capture_date')
        .eq('hotspot_id', hotspotId)
        .order('capture_date', { ascending: true });

      if (data) {
        const uniqueDates = Array.from(new Set(data.map(p => p.capture_date).filter(Boolean))) as string[];
        setAvailableDates(uniqueDates);
        if (uniqueDates.length > 0 && !currentCaptureDate) {
          setCurrentCaptureDate(uniqueDates[0]);
        }
      }
    };

    loadAvailableDates();
  }, [hotspotId, currentCaptureDate]);

  // Filtrar puntos por fecha actual
  useEffect(() => {
    if (currentCaptureDate) {
      const filtered = existingPoints.filter(p => p.capture_date === currentCaptureDate);
      setFilteredPoints(filtered);
    } else {
      setFilteredPoints(existingPoints);
    }
  }, [existingPoints, currentCaptureDate]);

  // Cargar panorama correspondiente a la fecha seleccionada
  useEffect(() => {
    if (!currentCaptureDate || !hotspotId) return;

    const loadPanoramaForDate = async () => {
      const { data } = await supabase
        .from('panorama_photos')
        .select('photo_url')
        .eq('hotspot_id', hotspotId)
        .eq('capture_date', currentCaptureDate)
        .order('display_order', { ascending: true })
        .limit(1)
        .single();

      if (data?.photo_url) {
        setCurrentPanoramaUrl(data.photo_url);
      }
    };

    loadPanoramaForDate();
  }, [currentCaptureDate, hotspotId]);

  const handleSave = async () => {
    await onSave(existingPoints);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMM yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Button 
          variant={viewMode === '2d' ? 'default' : 'outline'}
          onClick={() => setViewMode('2d')}
          size="sm"
        >
          <ImageIcon className="w-4 h-4 mr-1" />
          📐 Editor 2D
        </Button>
        <Button 
          variant={viewMode === '3d' ? 'default' : 'outline'}
          onClick={() => setViewMode('3d')}
          size="sm"
        >
          <Eye className="w-4 h-4 mr-1" />
          🌐 Preview 3D
        </Button>
        
        {availableDates.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={currentCaptureDate || undefined} onValueChange={setCurrentCaptureDate}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecciona fecha" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(date => (
                  <SelectItem key={date} value={date}>
                    {formatDate(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              ({filteredPoints.length} flechas)
            </span>
          </div>
        )}
      </div>

      {viewMode === '2d' ? (
        <NavigationArrowPlacementEditor2D
          hotspotId={hotspotId}
          panoramaUrl={currentPanoramaUrl}
          existingPoints={filteredPoints}
          availableTargets={availableTargets}
          currentCaptureDate={currentCaptureDate}
          onSave={handleSave}
          onToggle3D={() => setViewMode('3d')}
        />
      ) : (
        <NavigationArrowPlacementEditor3D
          hotspotId={hotspotId}
          panoramaUrl={currentPanoramaUrl}
          existingPoints={filteredPoints}
          availableTargets={availableTargets}
          currentCaptureDate={currentCaptureDate}
          onSave={handleSave}
          onToggle2D={() => setViewMode('2d')}
        />
      )}
    </div>
  );
};
