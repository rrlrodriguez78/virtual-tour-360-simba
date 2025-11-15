import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Image, CheckCircle2, XCircle, Loader2, Calendar as CalendarIcon, AlertCircle, Plus, Trash2, ChevronDown } from 'lucide-react';
import { matchPhotosToExistingHotspots, cleanupPreviews, type PhotoGroup, type HotspotPhotoMatch, type OptimizedPhotoGroup } from '@/utils/photoMatcher';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO } from 'date-fns';
import { es, enUS, fr, de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Hotspot } from '@/types/tour';
import { useAddPhotosToHotspot } from '@/hooks/useAddPhotosToHotspot';
import { Progress } from '@/components/ui/progress';
import { optimizeImage } from '@/utils/imageOptimization';

interface PhotoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingHotspots: Hotspot[];
  floorPlanId: string;
  tourId: string;
  tenantId?: string;
  onPhotosAdded: () => void;
}

export const PhotoGroupDialog = ({ 
  open, 
  onOpenChange, 
  existingHotspots,
  floorPlanId,
  tourId,
  tenantId,
  onPhotosAdded 
}: PhotoGroupDialogProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { addPhotos, isAdding } = useAddPhotosToHotspot();
  const queryClient = useQueryClient();
  
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'es': return es;
      case 'fr': return fr;
      case 'de': return de;
      default: return enUS;
    }
  };
  
  const [photoGroups, setPhotoGroups] = useState<OptimizedPhotoGroup[]>([
    { id: crypto.randomUUID(), name: `${t('photoImport.groupName')} 1`, photos: [], manualDate: null, optimizedPhotos: [], isOptimizing: false, optimizationProgress: 0 }
  ]);
  const [matches, setMatches] = useState<HotspotPhotoMatch[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validPhotos, setValidPhotos] = useState(0);
  const [ignoredPhotos, setIgnoredPhotos] = useState(0);

  useEffect(() => {
    if (!open) {
      // Cleanup on close - using callback pattern to avoid dependency issues
      setMatches(prevMatches => {
        // Cleanup previews
        prevMatches.forEach(match => {
          match.photos.forEach(photo => {
            if (photo.preview) {
              URL.revokeObjectURL(photo.preview);
            }
          });
        });
        return [];
      });
      
      setPhotoGroups([{ id: crypto.randomUUID(), name: `${t('photoImport.groupName')} 1`, photos: [], manualDate: null, optimizedPhotos: [], isOptimizing: false, optimizationProgress: 0 }]);
      setValidPhotos(0);
      setIgnoredPhotos(0);
    }
  }, [open, t]);

  const addPhotoGroup = () => {
    setPhotoGroups(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: `${t('photoImport.groupName')} ${prev.length + 1}`, photos: [], manualDate: null, optimizedPhotos: [], isOptimizing: false, optimizationProgress: 0 }
    ]);
  };

  const removePhotoGroup = (id: string) => {
    if (photoGroups.length === 1) return;
    setPhotoGroups(prev => prev.filter(g => g.id !== id));
    setMatches([]);
  };

  const updateGroupName = (id: string, name: string) => {
    setPhotoGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
  };

  const updateGroupDate = (id: string, date: Date | undefined) => {
    setPhotoGroups(prev => prev.map(g => g.id === id ? { ...g, manualDate: date || null } : g));
  };

  const handleGroupFilesChange = async (groupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Immediate placeholder update
    setPhotoGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, photos: files, isOptimizing: true, optimizationProgress: 0, optimizedPhotos: [] } : g
    ));
    setMatches([]);
    
    if (files.length > 0) {
      const group = photoGroups.find(g => g.id === groupId);
      toast({
        title: `${group?.name} ${t('photoImport.groupUpdated')}`,
        description: `${files.length} photos - Optimizing in background...`
      });
      
      // Background optimization
      try {
        const optimizedPhotos: Array<{ file: File; blob: Blob; originalSize: number; optimizedSize: number }> = [];
        
        // Parallelize optimization
        await Promise.all(
          files.map(async (file, index) => {
            try {
              const result = await optimizeImage(file, {
                maxWidth: 4000,
                quality: 0.85,
                format: 'webp',
                maxSizeMB: 10
              });
              
              optimizedPhotos[index] = {
                file,
                blob: result.blob,
                originalSize: result.originalSize,
                optimizedSize: result.optimizedSize
              };
              
              // Update progress
              setPhotoGroups(prev => prev.map(g => 
                g.id === groupId ? { ...g, optimizationProgress: Math.round(((index + 1) / files.length) * 100) } : g
              ));
            } catch (error) {
              console.error('Error optimizing photo:', file.name, error);
              // Keep original if optimization fails
              optimizedPhotos[index] = {
                file,
                blob: file,
                originalSize: file.size,
                optimizedSize: file.size
              };
            }
          })
        );
        
        // Update with optimized photos
        setPhotoGroups(prev => prev.map(g => 
          g.id === groupId ? { ...g, optimizedPhotos, isOptimizing: false, optimizationProgress: 100 } : g
        ));
        
        const totalSaved = optimizedPhotos.reduce((sum, p) => sum + (p.originalSize - p.optimizedSize), 0);
        const savingsPercent = Math.round((totalSaved / optimizedPhotos.reduce((sum, p) => sum + p.originalSize, 0)) * 100);
        
        toast({
          title: "Optimization complete!",
          description: `${files.length} photos ready. Saved ${savingsPercent}% (${(totalSaved / 1024 / 1024).toFixed(1)}MB)`
        });
      } catch (error) {
        console.error('Error in batch optimization:', error);
        setPhotoGroups(prev => prev.map(g => 
          g.id === groupId ? { ...g, isOptimizing: false } : g
        ));
        toast({
          title: "Optimization failed",
          description: "Using original photos",
          variant: "destructive"
        });
      }
    }
  };

  const handleAnalyze = async () => {
    const totalPhotos = photoGroups.reduce((sum, g) => sum + g.photos.length, 0);
    if (totalPhotos === 0) {
      toast({
        title: t('photoImport.missingPhotos'),
        description: t('photoImport.loadPhotosInGroup'),
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const results = await matchPhotosToExistingHotspots(existingHotspots, photoGroups);
      setMatches(results.matches);
      setValidPhotos(results.validPhotos);
      setIgnoredPhotos(results.ignoredPhotos);
      
      if (results.validPhotos === 0) {
        toast({
          title: t('photoImport.noMatches'),
          description: t('photoImport.noMatchesDesc'),
          variant: "destructive"
        });
      } else if (results.ignoredPhotos > 0) {
        toast({
          title: t('photoImport.analysisComplete'),
          description: `${results.validPhotos} ${t('photoImport.validPhotosOf')} ${totalPhotos} ${t('photoImport.total')} ${results.ignoredPhotos} ${t('photoImport.photosIgnored')}`
        });
      } else {
        toast({
          title: t('photoImport.allPhotosMatch'),
          description: `${results.validPhotos} ${t('photoImport.validPhotosFor')} ${results.matches.filter(m => m.status === 'matched').length} ${t('photoImport.points')}`
        });
      }
    } catch (error) {
      toast({
        title: t('photoImport.errorAddingPhotos'),
        description: t('photoImport.noMatchesFound'),
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddPhotos = async () => {
    const validMatches = matches.filter(m => m.status === 'matched');
    
    if (validMatches.length === 0) {
      toast({
        title: t('photoImport.noValidPhotos'),
        description: t('photoImport.noMatchesBetweenPhotosPoints'),
        variant: "destructive"
      });
      return;
    }

    const totalPhotos = validMatches.reduce((sum, match) => sum + match.photos.length, 0);
    const totalHotspots = validMatches.length;
    
    // Obtener el nombre del floor plan
    const floorPlanName = existingHotspots[0]?.floor_plan_id || 'plano';
    
    // Mostrar toast inicial con progreso
    setUploadProgress({ current: 0, total: totalPhotos });
    
    const progressToast = toast({
      title: "📤 Agregando fotos...",
      description: `0/${totalPhotos} fotos completadas`,
      duration: Infinity, // No auto-cerrar
    });

    try {
      let completedPhotos = 0;
      
      // Subir fotos a cada hotspot de forma secuencial para mejor feedback
      for (const match of validMatches) {
        const photosWithOptimized = match.photos.map(p => {
          const group = photoGroups.find(g => g.name === p.groupName);
          const optimized = group?.optimizedPhotos?.find(opt => opt.file === p.file);
          
          return {
            file: p.file,
            optimizedBlob: optimized?.blob || p.file,
            captureDate: p.captureDate,
            groupName: p.groupName
          };
        });
        
        await addPhotos({
          hotspotId: match.hotspot.id,
          photos: photosWithOptimized,
          tourId,
          floorPlanId,
          hotspotTitle: match.hotspot.title,
          tenantId
        });
        
        completedPhotos += match.photos.length;
        setUploadProgress({ current: completedPhotos, total: totalPhotos });
        
        // Actualizar toast de progreso
        progressToast.update({
          id: progressToast.id,
          title: "📤 Agregando fotos...",
          description: `${completedPhotos}/${totalPhotos} fotos completadas`,
          duration: Infinity,
        });
      }
      
      // Cerrar toast de progreso
      progressToast.dismiss();
      
      // Mostrar toast de éxito con detalles
      toast({
        title: "✅ Fotos agregadas exitosamente",
        description: `${totalPhotos} fotos agregadas a ${totalHotspots} puntos en el plano "${floorPlanName}"`,
        duration: 5000,
      });
      
      // Invalidar queries para forzar actualización de datos
      console.log('🔄 Invalidando queries para actualizar UI...');
      await queryClient.invalidateQueries({ 
        queryKey: ['panorama_photos', floorPlanId] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['hotspots', floorPlanId] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['floor_plans', tourId] 
      });
      
      // Callback para refetch adicional
      onPhotosAdded();
      
      // Pequeño delay antes de cerrar para que se vea el toast de éxito
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
      
    } catch (error) {
      console.error('Error agregando fotos:', error);
      
      // Cerrar toast de progreso
      progressToast.dismiss();
      
      toast({
        title: t('photoImport.errorAddingAllPhotos'),
        description: t('photoImport.couldNotAddAllPhotos'),
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const handleClose = () => {
    // Cleanup previews manually
    if (matches.length > 0) {
      matches.forEach(match => {
        match.photos.forEach(photo => {
          if (photo.preview) {
            URL.revokeObjectURL(photo.preview);
          }
        });
      });
    }
    
    setPhotoGroups([{ id: crypto.randomUUID(), name: `${t('photoImport.groupName')} 1`, photos: [], manualDate: null, optimizedPhotos: [], isOptimizing: false, optimizationProgress: 0 }]);
    setMatches([]);
    setValidPhotos(0);
    setIgnoredPhotos(0);
    
    onOpenChange(false);
  };

  const matchedHotspots = matches.filter(m => m.status === 'matched').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('photoImport.title')}</DialogTitle>
          <DialogDescription>
            {t('photoImport.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <Collapsible>
            <Card className="border-2 border-red-600 bg-red-50 dark:bg-red-950/20">
              <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-800 dark:text-red-400 font-semibold text-sm">
                    {t('photoImport.matchingRulesTitle')}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-red-600 transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <div className="text-red-700 dark:text-red-300 space-y-2 text-xs mt-2">
                  <p>{t('photoImport.matchingRulesDesc')}</p>
                  <div className="mt-1">
                    <p className="font-semibold">{t('photoImport.validExamples')}</p>
                    <ul className="list-disc list-inside ml-1 space-y-0.5">
                      <li>{t('photoImport.example1')}</li>
                      <li>{t('photoImport.example2')}</li>
                    </ul>
                  </div>
                  <p className="font-semibold">{t('photoImport.differentNamesIgnored')}</p>
                  <div className="mt-1 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-700">
                    <p className="font-semibold text-blue-800 dark:text-blue-300">{t('photoImport.alternativeTitle')}</p>
                    <p className="text-blue-700 dark:text-blue-400">{t('photoImport.alternativeDesc')}</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Alerta informativa */}
          {existingHotspots.length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('photoImport.noPoints')}</AlertTitle>
              <AlertDescription>
                {t('photoImport.noPointsDesc')}
              </AlertDescription>
            </Alert>
          )}

          {existingHotspots.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('photoImport.availablePoints', { count: existingHotspots.length })}</AlertTitle>
              <AlertDescription>
                {t('photoImport.matchingDesc')}{existingHotspots.slice(0, 5).map(h => h.title).join(', ')}
                {existingHotspots.length > 5 && ` and ${existingHotspots.length - 5} more...`}
              </AlertDescription>
            </Alert>
          )}

          {/* Sección grupos de fotos */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold">{t('photoImport.photoGroups')}</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addPhotoGroup}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('photoImport.addGroup')}
              </Button>
            </div>

            <div className="space-y-3">
              {photoGroups.map((group, idx) => (
                <Card key={group.id} className="p-3 border-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Badge variant="secondary">#{idx + 1}</Badge>
                      <Input
                        value={group.name}
                        onChange={(e) => updateGroupName(group.id, e.target.value)}
                        className="h-8"
                        placeholder={t('photoImport.groupNamePlaceholder')}
                      />
                    </div>
                    {photoGroups.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removePhotoGroup(group.id)}
                        className="h-8 w-8 ml-2"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      id={`file-${group.id}`}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.JPG,.JPEG"
                      className="hidden"
                      onChange={(e) => handleGroupFilesChange(group.id, e)}
                    />
                    
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => document.getElementById(`file-${group.id}`)?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {group.photos.length === 0
                        ? t('photoImport.selectPhotos')
                        : `✓ ${group.photos.length} ${t('photoImport.photosLoaded')}`}
                    </Button>

                    {group.photos.length > 0 && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            {t('photoImport.captureDate')}
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="w-full justify-start h-9 text-sm"
                              >
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {group.manualDate
                                  ? format(group.manualDate, "PPP", { locale: getDateLocale() })
                                  : t('photoImport.detectOrSelect')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={group.manualDate || undefined}
                                onSelect={(date) => updateGroupDate(group.id, date)}
                                disabled={(date) => date > new Date()}
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        {group.isOptimizing && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Optimizing...</span>
                              <span className="text-primary font-medium">{group.optimizationProgress}%</span>
                            </div>
                            <Progress value={group.optimizationProgress} className="h-1.5" />
                          </div>
                        )}
                        
                        {!group.isOptimizing && group.optimizedPhotos.length > 0 && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            <span>Optimized and ready</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Botón analizar */}
          {photoGroups.some(g => g.photos.length > 0) && matches.length === 0 && existingHotspots.length > 0 && (
            <Button 
              className="w-full" 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('photoImport.analyzing')}
                </>
              ) : (
                t('photoImport.analyzeMatches')
              )}
            </Button>
          )}

          {/* Preview de matches */}
          {matches.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3 p-3 bg-primary/5 rounded-lg">
                <div>
                  <h3 className="font-semibold">
                    {validPhotos > 0 ? t('photoImport.analysisCompleted') : t('photoImport.withoutMatches')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {matchedHotspots} {t('photoImport.pointsWithValidPhotos')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{validPhotos}</p>
                  <p className="text-xs text-muted-foreground">{t('photoImport.validPhotos')}</p>
                  {ignoredPhotos > 0 && (
                    <p className="text-xs text-destructive">{ignoredPhotos} {t('photoImport.ignored')}</p>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {matches.map((match, idx) => (
                    <Card
                      key={idx}
                      className={cn(
                        "p-3",
                        match.status === 'no-match' && "border-muted bg-muted/20"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                            <h4 className="font-semibold font-mono text-sm">{match.hotspot.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {match.photos.length} {t('photoImport.photosFound')}
                          </p>
                        </div>
                        {match.status === 'matched' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>

                      {match.photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {match.photos.map((photo, pIdx) => (
                            <div
                              key={pIdx}
                              className="flex items-center gap-2 p-2 bg-card rounded border"
                            >
                              <img
                                src={photo.preview}
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                                alt=""
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {photo.groupName}
                                </p>
                                {photo.captureDate ? (
                                  <p className="text-xs text-primary">
                                    📅 {format(parseISO(photo.captureDate), "dd/MM/yyyy")}
                                  </p>
                                ) : (
                                  <p className="text-xs text-yellow-600">
                                    ⚠️ Sin fecha
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            Cancelar
          </Button>
          {matches.length > 0 && validPhotos > 0 && (
            <Button onClick={handleAddPhotos} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agregando...
                </>
              ) : (
                `Agregar Fotos a Puntos (${validPhotos})`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};