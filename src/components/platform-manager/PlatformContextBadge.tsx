import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Layers } from 'lucide-react';
import { usePlatformEditor } from '@/contexts/PlatformEditorContext';
import { cn } from '@/lib/utils';

export const PlatformContextBadge = () => {
  const { currentPlatform, isEditorOpen } = usePlatformEditor();

  const getPrefixForPlatform = (platform: 'web' | 'android' | 'both'): string => {
    switch (platform) {
      case 'web':
        return '[WEB 🔵]';
      case 'android':
        return '[ANDROID 🟢]';
      case 'both':
        return '[AMBOS 🟣]';
      default:
        return '';
    }
  };

  const getPlatformConfig = (platform: 'web' | 'android' | 'both') => {
    switch (platform) {
      case 'web':
        return {
          icon: Monitor,
          label: 'Web Desktop',
          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500',
          emoji: '🔵'
        };
      case 'android':
        return {
          icon: Smartphone,
          label: 'Android Mobile',
          color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500',
          emoji: '🟢'
        };
      case 'both':
        return {
          icon: Layers,
          label: 'Ambos Sistemas',
          color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500',
          emoji: '🟣'
        };
    }
  };

  if (!isEditorOpen) return null;

  const config = getPlatformConfig(currentPlatform);
  const Icon = config.icon;

  return (
    <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <Badge 
        variant="outline" 
        className={cn(
          "gap-2 px-4 py-2 text-sm font-semibold shadow-lg border-2",
          config.color
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{config.emoji} {config.label}</span>
      </Badge>
      
      <div className="mt-2 text-xs text-center text-muted-foreground bg-background/90 backdrop-blur px-3 py-1 rounded-full border">
        Contexto activo para IA
      </div>
    </div>
  );
};
