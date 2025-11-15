-- Limpiar jobs bloqueados que llevan más de 1 hora en processing
UPDATE backup_jobs 
SET status = 'failed', 
    error_message = 'Timeout - Job exceeded CPU limits',
    completed_at = now()
WHERE status = 'processing' 
AND created_at < now() - interval '1 hour';

-- Limpiar queue items relacionados
UPDATE backup_queue
SET status = 'failed',
    error_message = 'Job timeout - parent job failed',
    completed_at = now()
WHERE status = 'processing'
AND started_at < now() - interval '1 hour';

-- Función para monitorear jobs atascados
CREATE OR REPLACE FUNCTION public.monitor_stuck_backup_jobs()
RETURNS TABLE(job_id uuid, tour_id uuid, stuck_for_hours numeric, current_part integer, total_parts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bj.id as job_id,
    bj.tour_id,
    ROUND(EXTRACT(EPOCH FROM (NOW() - bj.created_at)) / 3600, 2) as stuck_for_hours,
    (bj.metadata->>'current_part')::integer as current_part,
    (bj.metadata->>'total_parts')::integer as total_parts
  FROM backup_jobs bj
  WHERE bj.status = 'processing'
  AND bj.created_at < NOW() - INTERVAL '30 minutes'
  ORDER BY stuck_for_hours DESC;
END;
$function$;