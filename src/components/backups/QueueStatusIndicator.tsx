import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, AlertCircle } from 'lucide-react';

interface QueueStats {
  pending_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
  total_count: number;
}

interface Props {
  tourId: string;
  className?: string;
}

export const QueueStatusIndicator = ({ tourId, className = '' }: Props) => {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQueueStats = async () => {
    if (!tourId) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_queue_stats_by_tour', { p_tour_id: tourId });
      
      if (error) {
        console.error('Error fetching queue stats:', error);
        return;
      }
      
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch queue stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStats();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchQueueStats, 5000);
    
    return () => clearInterval(interval);
  }, [tourId]);

  if (loading || !stats) return null;

  const hasActivity = stats.pending_count > 0 || stats.processing_count > 0;
  
  if (!hasActivity) return null;

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="text-muted-foreground">Cola:</span>
      
      {stats.pending_count > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          {stats.pending_count} pendiente{stats.pending_count !== 1 ? 's' : ''}
        </Badge>
      )}
      
      {stats.processing_count > 0 && (
        <Badge variant="default" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {stats.processing_count} procesando
        </Badge>
      )}
      
      {stats.failed_count > 0 && (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {stats.failed_count} fallida{stats.failed_count !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
};
