import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertCircle, X, Clock, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SyncJob {
  id: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_messages: Array<{ photoId: string; error: string }>;
}

interface Props {
  open: boolean;
  job: SyncJob | null;
  alreadySynced?: number;
  onClose: () => void;
  onCancel: () => void;
  tourId?: string; // FASE 5: Needed for checking stalled photos
}

export const SyncProgressDialog: React.FC<Props> = ({ 
  open, 
  job, 
  alreadySynced = 0,
  onClose, 
  onCancel,
  tourId
}) => {
  // FASE 5: Performance tracking
  const [startTime] = useState(Date.now());
  const [photosPerMinute, setPhotosPerMinute] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  
  // FASE 5: Stalled photos detection
  const [stalledCount, setStalledCount] = useState(0);

  // Check for stalled photos (processing > 5 minutes)
  useEffect(() => {
    if (!tourId || !job || job.status !== 'processing') return;

    const checkStalled = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { count } = await supabase
        .from('photo_sync_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tour_id', tourId)
        .eq('status', 'processing')
        .lt('updated_at', fiveMinutesAgo);
      
      setStalledCount(count || 0);
    };

    checkStalled();
    const interval = setInterval(checkStalled, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [tourId, job]);

  // Handle force retry of stalled photos
  const handleForceRetry = async () => {
    if (!tourId) return;

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('photo_sync_queue')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('tour_id', tourId)
        .eq('status', 'processing')
        .lt('updated_at', fiveMinutesAgo);

      if (error) throw error;

      setStalledCount(0);
      // Trigger worker
      await supabase.functions.invoke('photo-queue-worker', {});
      
    } catch (error) {
      console.error('Failed to retry stalled photos:', error);
    }
  };

  useEffect(() => {
    if (!job || job.status !== 'processing') return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
      if (elapsed > 0 && job.processed_items > 0) {
        const rate = job.processed_items / elapsed;
        setPhotosPerMinute(rate);

        const remaining = job.total_items - job.processed_items;
        if (rate > 0) {
          const minutesRemaining = remaining / rate;
          if (minutesRemaining < 1) {
            setEstimatedTimeRemaining('< 1 min');
          } else if (minutesRemaining < 60) {
            setEstimatedTimeRemaining(`~${Math.ceil(minutesRemaining)} min`);
          } else {
            const hours = Math.floor(minutesRemaining / 60);
            const mins = Math.ceil(minutesRemaining % 60);
            setEstimatedTimeRemaining(`~${hours}h ${mins}m`);
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [job, startTime]);

  if (!job) return null;

  const progress = job.total_items > 0 
    ? (job.processed_items / job.total_items) * 100 
    : 0;

  const isComplete = ['completed', 'failed', 'cancelled'].includes(job.status);
  const successCount = job.processed_items - job.failed_items;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {job.status === 'processing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                Sincronizando Fotos...
              </>
            )}
            {job.status === 'completed' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Sincronización Completa
              </>
            )}
            {job.status === 'failed' && (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Sincronización Fallida
              </>
            )}
            {job.status === 'cancelled' && (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Sincronización Cancelada
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {job.id === 'verifying' 
              ? '🔍 Verificando archivos en Google Drive. Esto puede tomar unos minutos...'
              : job.status === 'processing' 
                ? 'El proceso continuará ejecutándose por hasta 10 minutos. Puedes cerrar esta ventana, pero es recomendable mantenerla abierta para monitorear el progreso.'
                : 'El proceso ha finalizado.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          {job.id !== 'verifying' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">Progreso</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {job.processed_items} / {job.total_items} fotos
                  </span>
                  {/* FASE 5: Speed indicator */}
                  {job.status === 'processing' && photosPerMinute > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Zap className="h-3 w-3" />
                      {photosPerMinute.toFixed(1)}/min
                    </Badge>
                  )}
                </div>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.toFixed(0)}% completado</span>
                {/* FASE 5: Estimated time remaining */}
                {job.status === 'processing' && estimatedTimeRemaining && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {estimatedTimeRemaining}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* FASE 5: Stalled photos warning */}
          {stalledCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <p className="font-semibold">
                  {stalledCount} {stalledCount === 1 ? 'foto está' : 'fotos están'} atascadas ({'>'}5 min procesando)
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleForceRetry}
                  className="w-fit"
                >
                  Forzar reintento
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {job.id === 'verifying' && (
            <div className="space-y-2">
              <Progress value={0} className="h-2 animate-pulse" />
              <div className="text-xs text-muted-foreground text-center">
                Verificando archivos...
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {job.id !== 'verifying' && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                <div className="text-green-600 dark:text-green-400 font-medium text-xs">✓ Sincronizadas</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{successCount}</div>
              </div>

              {job.failed_items > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                  <div className="text-red-600 dark:text-red-400 font-medium text-xs">✗ Fallidas</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{job.failed_items}</div>
                </div>
              )}

              {alreadySynced > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">⏭ Ya existían</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{alreadySynced}</div>
                </div>
              )}
            </div>
          )}

          {/* Error Messages */}
          {job.error_messages && job.error_messages.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Errores encontrados:</div>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {job.error_messages.map((err, idx) => (
                    <li key={idx} className="font-mono">
                      {err.photoId.slice(0, 8)}: {err.error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            {job.status === 'processing' && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onCancel}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
            {isComplete && (
              <Button 
                variant="default" 
                size="sm"
                onClick={onClose}
              >
                Cerrar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
