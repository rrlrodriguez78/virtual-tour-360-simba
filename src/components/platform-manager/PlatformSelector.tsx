import { Monitor, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PlatformSelectorProps {
  value: 'web' | 'android';
  onChange: (platform: 'web' | 'android') => void;
  className?: string;
}

export const PlatformSelector = ({ value, onChange, className }: PlatformSelectorProps) => {
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        onClick={() => onChange('web')}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
          value === 'web' 
            ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" 
            : "border-border hover:border-blue-500/50"
        )}
      >
        <Monitor className="h-5 w-5" />
        <div className="text-left">
          <div className="font-semibold text-sm">Web</div>
          <div className="text-xs opacity-70">Desktop</div>
        </div>
      </button>
      
      <button
        onClick={() => onChange('android')}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
          value === 'android' 
            ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400" 
            : "border-border hover:border-green-500/50"
        )}
      >
        <Smartphone className="h-5 w-5" />
        <div className="text-left">
          <div className="font-semibold text-sm">Android</div>
          <div className="text-xs opacity-70">Mobile</div>
        </div>
      </button>
    </div>
  );
};
