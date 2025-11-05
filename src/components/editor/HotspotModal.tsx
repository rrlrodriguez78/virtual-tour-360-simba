import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Info, Palette, MapPin, Home, Star, Heart, Eye, Compass } from 'lucide-react';
import { toast } from 'sonner';
import PanoramaManager from './PanoramaManager';
import { NavigationPointsEditor } from './NavigationPointsEditor';
import { useTranslation } from 'react-i18next';
import { Hotspot } from '@/types/tour';
import { supabase } from '@/integrations/supabase/client';

export type HotspotData = Omit<Hotspot, 'floor_plan_id' | 'created_at' | 'id'> & { id?: string };

interface HotspotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: HotspotData) => Promise<void>;
  initialData?: HotspotData;
  mode: 'create' | 'edit';
  allHotspots?: Hotspot[];
  tourType?: 'tour_360' | 'photo_tour';
  tourId?: string;
}

export default function HotspotModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
  allHotspots = [],
  tourType,
  tourId,
}: HotspotModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('info');
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<HotspotData>(() => {
    // Siempre priorizar initialData si existe
    if (initialData) {
      return {
        ...initialData,
        style: initialData.style || {
          icon: 'map-pin',
          color: '#3b82f6',
          size: 32,
        }
      };
    }
    
    // Solo usar valores por defecto si NO hay initialData
    return {
      title: '',
      description: '',
      x_position: 50,
      y_position: 50,
      style: {
        icon: 'map-pin',
        color: '#3b82f6',
        size: 32,
      },
    };
  });

  // Actualizar formData cuando initialData cambie
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        style: initialData.style || formData.style
      });
    }
  }, [initialData]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error(t('hotspot.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      // Don't call onClose here - let the parent component handle it
    } catch (error) {
      console.error('Error saving hotspot:', error);
      toast.error(t('hotspot.errorSaving'));
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${
        activeTab === 'navigation' 
          ? 'max-w-[95vw] lg:max-w-[1400px]' 
          : 'max-w-2xl'
      }`}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('hotspot.new') : t('hotspot.edit')}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${
            mode === 'create' 
              ? 'grid-cols-2' 
              : tourType === 'tour_360' 
                ? 'grid-cols-4' 
                : 'grid-cols-3'
          }`}>
            <TabsTrigger value="info" className="gap-2">
              <Info className="w-4 h-4" />
              {t('hotspot.information')}
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-2">
              <Palette className="w-4 h-4" />
              {t('hotspot.style')}
            </TabsTrigger>
            {mode === 'edit' && (
              <TabsTrigger value="panorama" className="gap-2">
                <Eye className="w-4 h-4" />
                {t('hotspot.photos360')}
              </TabsTrigger>
            )}
            {mode === 'edit' && tourType === 'tour_360' && (
              <TabsTrigger value="navigation" className="gap-2">
                <Compass className="w-4 h-4" />
                {t('hotspot.navigation')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('hotspot.title')} *</Label>
              <Input
                id="title"
                placeholder={t('hotspot.titlePlaceholder')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('hotspot.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('hotspot.descriptionPlaceholder')}
                rows={4}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="x_position">{t('hotspot.positionX')}</Label>
                <Input
                  id="x_position"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.x_position}
                  onChange={(e) =>
                    setFormData({ ...formData, x_position: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="y_position">{t('hotspot.positionY')}</Label>
                <Input
                  id="y_position"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.y_position}
                  onChange={(e) =>
                    setFormData({ ...formData, y_position: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="style" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">{t('hotspot.icon')}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: MapPin, name: 'map-pin' },
                    { icon: Home, name: 'home' },
                    { icon: Star, name: 'star' },
                    { icon: Heart, name: 'heart' },
                  ].map(({ icon: Icon, name }) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="icon"
                      className={`h-14 ${formData.style?.icon === name ? 'ring-2 ring-primary' : ''}`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          style: { ...formData.style!, icon: name },
                        })
                      }
                    >
                      <Icon className="w-6 h-6" />
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="icon-color" className="text-base font-semibold">
                  {t('hotspot.color')}
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="icon-color"
                    type="color"
                    value={formData.style?.color || '#3b82f6'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style!, color: e.target.value },
                      })
                    }
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={formData.style?.color || '#3b82f6'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style!, color: e.target.value },
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">
                  {t('hotspot.size')}: {formData.style?.size || 32}px
                </Label>
                <Slider
                  value={[formData.style?.size || 32]}
                  onValueChange={([val]) =>
                    setFormData({
                      ...formData,
                      style: { ...formData.style!, size: val },
                    })
                  }
                  min={24}
                  max={64}
                  step={4}
                  className="mt-2"
                />
              </div>

              <div className="bg-muted p-6 rounded-lg">
                <Label className="text-sm font-semibold mb-2 block">{t('hotspot.preview')}</Label>
                <div className="flex items-center justify-center p-4 bg-background rounded">
                  {(() => {
                    const iconName = formData.style?.icon || 'map-pin';
                    const iconMap: Record<string, any> = {
                      'map-pin': MapPin,
                      'home': Home,
                      'star': Star,
                      'heart': Heart,
                    };
                    const IconComponent = iconMap[iconName] || MapPin;
                    return (
                      <IconComponent
                        style={{
                          width: `${formData.style?.size || 32}px`,
                          height: `${formData.style?.size || 32}px`,
                          color: formData.style?.color || '#3b82f6',
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          </TabsContent>

          {mode === 'edit' && (
            <TabsContent value="panorama" className="space-y-4 mt-4">
              {initialData?.id ? (
                <PanoramaManager hotspotId={initialData.id} tourId={tourId} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">{t('hotspot.saveFirst')}</p>
                </div>
              )}
            </TabsContent>
          )}

          {mode === 'edit' && tourType === 'tour_360' && (
            <TabsContent value="navigation" className="space-y-4 mt-4">
              {initialData?.id && initialData.has_panorama ? (
                <NavigationPointsEditor
                  hotspot={formData as Hotspot}
                  allHotspots={allHotspots}
                  onSave={() => {
                    toast.success(t('hotspot.navigationUpdated'));
                  }}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Compass className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-medium mb-2">
                    {t('hotspot.navigationUnavailable')}
                  </p>
                  <p className="text-xs">
                    {!initialData?.id 
                      ? t('hotspot.saveFirstForNavigation')
                      : t('hotspot.addPanoramasFirst')
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : mode === 'create' ? t('hotspot.creating') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
