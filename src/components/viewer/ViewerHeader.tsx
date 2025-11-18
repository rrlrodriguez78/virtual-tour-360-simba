import { Button } from '@/components/ui/button';
import { Maximize2, Info, Share2, ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface ViewerHeaderProps {
  tourTitle: string;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  unlockOrientation?: () => void;
  isOnline?: boolean;
}

export const ViewerHeader = ({ tourTitle, onToggleFullscreen, isFullscreen, unlockOrientation, isOnline = true }: ViewerHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Detectar si es PWA instalada
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');
  
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success(t('viewer.linkCopied'));
  };

  const handleHelp = () => {
    toast.info(t('viewer.helpMessage'));
  };

  const handleBack = () => {
    if (unlockOrientation) {
      unlockOrientation();
    }
    navigate('/app/tours');
  };

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-2 md:px-4 py-2 md:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="sm" onClick={handleBack} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base md:text-xl font-bold text-foreground truncate">{tourTitle}</h1>
            {!isOnline && (
              <Badge variant="secondary" className="gap-1 shrink-0">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Offline</span>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleHelp} className="min-w-[44px] min-h-[44px]">
              <Info className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('viewer.help')}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare} className="min-w-[44px] min-h-[44px]">
              <Share2 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">{t('viewer.share')}</span>
            </Button>
            {/* Ocultar botón de fullscreen en PWA */}
            {!isStandalone && (
              <Button variant="ghost" size="sm" onClick={onToggleFullscreen} className="min-w-[44px] min-h-[44px]">
                <Maximize2 className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{isFullscreen ? t('viewer.exit') : t('viewer.fullscreen')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
