import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PanoramaPhoto } from '@/types/tour';
import { Hotspot, FloorPlan } from '@/types/tour';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface PhotoGalleryViewerProps {
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
}

export const PhotoGalleryViewer = ({
  isVisible,
  onClose,
  photos,
  activePhoto,
  setActivePhoto,
  hotspotName,
  allHotspotsOnFloor,
  onNavigate,
  floorPlans,
  currentFloorPlan,
  onFloorChange,
  hotspotsByFloor
}: PhotoGalleryViewerProps) => {
  const { i18n } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>('all');

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const formatDate = (dateString: string) => {
    // Agregar tiempo local para evitar desfase de zona horaria
    const date = new Date(dateString + 'T00:00:00');
    const locale = i18n.language === 'es' ? es : enUS;
    return format(date, 'dd MMM yyyy', { locale });
  };

  const filteredPhotos = photos.filter(photo => {
    if (!activePhoto) return true;
    return photo.hotspot_id === activePhoto.hotspot_id;
  });

  const availableDates = Array.from(
    new Set(filteredPhotos.map(p => p.capture_date).filter(Boolean))
  ).sort((a, b) => {
    const dateA = new Date(a! + 'T00:00:00');
    const dateB = new Date(b! + 'T00:00:00');
    return dateB.getTime() - dateA.getTime();
  });

  const photosByDate = selectedDate === 'all' 
    ? filteredPhotos 
    : filteredPhotos.filter(p => p.capture_date === selectedDate);

  const currentPhotoIndex = activePhoto 
    ? photosByDate.findIndex(p => p.id === activePhoto.id) 
    : 0;

  const handlePrevious = () => {
    if (currentPhotoIndex > 0) {
      setActivePhoto(photosByDate[currentPhotoIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentPhotoIndex < photosByDate.length - 1) {
      setActivePhoto(photosByDate[currentPhotoIndex + 1]);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  const currentHotspot = allHotspotsOnFloor.find(h => h.id === activePhoto?.hotspot_id);

  if (!isVisible || !activePhoto) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
              <div className="text-white">
                <h2 className="text-xl font-semibold">{hotspotName}</h2>
                <p className="text-sm text-white/70">
                  {currentPhotoIndex + 1} / {photosByDate.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Floor selector */}
              {floorPlans && floorPlans.length > 1 && (
                <Select
                  value={currentFloorPlan?.id}
                  onValueChange={onFloorChange}
                >
                  <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {floorPlans.map(floor => (
                      <SelectItem key={floor.id} value={floor.id}>
                        {floor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Main photo area */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          <AnimatePresence mode="wait">
            <motion.img
              key={activePhoto.id}
              src={activePhoto.photo_url}
              alt={activePhoto.description || hotspotName}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: zoom }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="max-w-full max-h-full object-contain"
              style={{ transformOrigin: 'center' }}
            />
          </AnimatePresence>

          {/* Navigation arrows */}
          {currentPhotoIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="absolute left-4 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {currentPhotoIndex < photosByDate.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 text-white hover:bg-white/20 h-12 w-12"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex flex-col gap-4">
            {/* Zoom controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="text-white hover:bg-white/20"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={resetZoom}
                className="text-white hover:bg-white/20 px-4"
              >
                {Math.round(zoom * 100)}%
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="text-white hover:bg-white/20"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
            </div>

            {/* Date selector and hotspot navigation */}
            <div className="flex items-center justify-between gap-4">
              {/* Date selector */}
              {availableDates.length > 0 && (
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    {availableDates.map(date => (
                      <SelectItem key={date} value={date!}>
                        {formatDate(date!)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Hotspot navigation */}
              {allHotspotsOnFloor.length > 1 && (
                <Select
                  value={currentHotspot?.id}
                  onValueChange={(hotspotId) => {
                    const hotspot = allHotspotsOnFloor.find(h => h.id === hotspotId);
                    if (hotspot) onNavigate(hotspot);
                  }}
                >
                  <SelectTrigger className="w-[250px] bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allHotspotsOnFloor.map(hotspot => (
                      <SelectItem key={hotspot.id} value={hotspot.id}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {hotspot.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photosByDate.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setActivePhoto(photo)}
                  className={`flex-shrink-0 relative rounded overflow-hidden transition-all ${
                    photo.id === activePhoto.id
                      ? 'ring-2 ring-primary scale-110'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photo.photo_url_thumbnail || photo.photo_url}
                    alt=""
                    className="h-16 w-24 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};