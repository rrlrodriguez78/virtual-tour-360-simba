import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState, useCallback, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Map, Upload, RefreshCw, AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { SyncProgressDialog } from "./SyncProgressDialog";
import { QueueStatusIndicator } from "./QueueStatusIndicator";

interface Tour {
  id: string;
  title: string;
  tenant_id: string;
}

interface SyncJob {
  id: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_messages: Array<{ photoId: string; error: string }>;
}

interface Props {
  tenantId: string;
}

export const BatchPhotoSync: React.FC<Props> = ({ tenantId }) => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingFloorPlans, setSyncingFloorPlans] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // New job-based states
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const [alreadySyncedCount, setAlreadySyncedCount] = useState(0);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Old progress states (for floor plans)
  const [progress, setProgress] = useState<{
    synced: number;
    failed: number;
    total: number;
    alreadySynced: number;
  } | null>(null);
  const [floorPlanProgress, setFloorPlanProgress] = useState<{
    synced: number;
    failed: number;
    total: number;
    alreadySynced: number;
  } | null>(null);
  const [errors, setErrors] = useState<Array<{ photoId: string; error: string }>>([]);
  const [floorPlanErrors, setFloorPlanErrors] = useState<string[]>([]);

  useEffect(() => {
    loadTours();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [tenantId]);

  // Check for active jobs on mount with automatic recovery
  useEffect(() => {
    const checkActiveJobs = async () => {
      if (!tenantId) return;
      
      try {
        const { data: activeJobs, error } = await supabase
          .from('sync_jobs')
          .select('id, status, processed_items, total_items, job_type, started_at, created_at')
          .eq('tenant_id', tenantId)
          .in('status', ['processing', 'pending'])
          .order('started_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        if (activeJobs && activeJobs.length > 0) {
          const job = activeJobs[0];
          const timeSinceStart = Date.now() - new Date(job.started_at || job.created_at).getTime();
          const fifteenMinutes = 15 * 60 * 1000;
          
          if (timeSinceStart > fifteenMinutes) {
            // Job is stalled, mark as failed
            console.warn('⏱️ Job timed out:', job.id);
            await supabase
              .from('sync_jobs')
              .update({ 
                status: 'failed',
                error_message: 'Process timeout - exceeded 15 minutes'
              })
              .eq('id', job.id);
            
            toast.error('Previous sync timed out', {
              description: 'Please try again'
            });
          } else {
            // Resume active job
            console.log('📸 Resuming active sync job:', job.id);
            setShowProgressDialog(true);
            
            // Start polling manually without calling startPolling yet (to avoid dependency issues)
            pollJobProgress(job.id);
            const intervalId = setInterval(() => {
              pollJobProgress(job.id);
            }, 2000);
            pollingIntervalRef.current = intervalId;
            
            toast.info('Resuming sync in progress...', {
              description: `${job.processed_items}/${job.total_items} photos processed`
            });
          }
        }
      } catch (error) {
        console.error('Error checking active jobs:', error);
      }
    };
    
    checkActiveJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const loadTours = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('virtual_tours')
        .select('id, title, tenant_id')
        .eq('tenant_id', tenantId)
        .order('title');

      if (error) throw error;
      setTours(data || []);
    } catch (error) {
      console.error('Error loading tours:', error);
      toast.error('Error loading tours');
    } finally {
      setLoading(false);
    }
  };

  // Poll job progress
  const pollJobProgress = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'get_progress',
          jobId
        }
      });

      if (error) throw error;

      if (data.success && data.job) {
        setCurrentJob(data.job);
        
        // Detectar errores de cuota
        const isQuotaError = data.job.error_message?.includes('QUOTA_EXCEEDED') || 
                            data.job.error_message?.toLowerCase().includes('quota exceeded');
        
        if (isQuotaError && !quotaError) {
          setQuotaError(true);
          toast.error('🚨 Google Drive storage full!', {
            description: 'Please free up space or upgrade your storage plan',
            duration: 10000
          });
        }

        // Stop polling if job is complete
        if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Show final notification
          if (data.job.status === 'completed') {
            const successCount = data.job.processed_items - data.job.failed_items;
            if (data.job.failed_items === 0) {
              toast.success(`✅ ${successCount} photos synced successfully`);
            } else {
              toast.warning(`⚠️ ${successCount} synced, ${data.job.failed_items} failed`);
            }
          } else if (data.job.status === 'cancelled') {
            toast.info('Sync cancelled');
          } else if (data.job.status === 'failed') {
            if (!isQuotaError) {
              toast.error('Sync failed');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error polling job:', error);
    }
  }, []);

  // Start polling
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll immediately
    pollJobProgress(jobId);

    // Then poll every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      pollJobProgress(jobId);
    }, 2000);
  }, [pollJobProgress]);

  // Cancel job
  const handleCancelJob = async () => {
    if (!currentJob) return;

    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'cancel_job',
          jobId: currentJob.id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.info('Cancelling sync...');
        // Update will come from next poll
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast.error('Error cancelling');
    }
  };

  // New handleSync with job-based approach
  const handleSync = async () => {
    if (!selectedTourId) {
      toast.error('Select a tour');
      return;
    }

    setSyncing(true);
    setCurrentJob(null);
    setAlreadySyncedCount(0);
    setQuotaError(false);

    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'start_job',
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (error) throw error;

      if (data.success && data.jobId) {
        setAlreadySyncedCount(data.alreadySynced || 0);
        setShowProgressDialog(true);
        toast.info(`🚀 Starting sync of ${data.totalPhotos} photos...`);
        
        // Start polling for progress
        startPolling(data.jobId);
      } else if (data.success && !data.jobId) {
        // No photos to sync
        toast.info(data.message);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFloorPlans = async () => {
    if (!selectedTourId) {
      toast.error('Select a tour');
      return;
    }

    setSyncingFloorPlans(true);
    setFloorPlanProgress(null);
    setFloorPlanErrors([]);

    try {
      const { data, error } = await supabase.functions.invoke('sync-all-floor-plans', {
        body: {
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (error) throw error;

      if (data.success) {
        setFloorPlanProgress({
          synced: data.synced,
          failed: data.failed,
          total: data.total,
          alreadySynced: data.alreadySynced || 0
        });
        setFloorPlanErrors(data.errors || []);

        if (data.failed === 0) {
          toast.success(`✅ ${data.synced} floor plans synced`);
        } else {
          toast.warning(`⚠️ ${data.synced} synced, ${data.failed} failed`);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Floor plan sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Error syncing floor plans');
    } finally {
      setSyncingFloorPlans(false);
    }
  };

  const handleVerifyAndResync = async () => {
    if (!selectedTourId) {
      toast.error('Select a tour');
      return;
    }

    setVerifying(true);
    
    // ✅ Create temporary job to show progress immediately
    setCurrentJob({
      id: 'verifying',
      status: 'processing',
      total_items: 0,
      processed_items: 0,
      failed_items: 0,
      error_messages: []
    });
    setAlreadySyncedCount(0);
    setShowProgressDialog(true); // ✅ Open dialog immediately
    
    toast.info('🔍 Verifying files in Google Drive...');

    try {
      const { data, error } = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'verify_and_resync',
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (error) throw error;

      if (data.success) {
        const totalMissing = (data.missingPhotos || 0) + (data.missingFloorPlans || 0);
        
        if (totalMissing === 0) {
          setShowProgressDialog(false);
          setCurrentJob(null);
          toast.success('✅ All files verified', {
            description: `${data.verified || 0} files are properly synced`
          });
        } else {
          const message = [];
          if (data.missingPhotos > 0) message.push(`${data.missingPhotos} photos`);
          if (data.missingFloorPlans > 0) message.push(`${data.missingFloorPlans} floor plans`);
          
          toast.success(`Found ${totalMissing} missing files`, {
            description: `Re-syncing ${message.join(' and ')}...`
          });
          
          // If there's a job (photos to sync), start polling
          if (data.jobId) {
            startPolling(data.jobId);
          } else {
            // Only floor plans were synced (no job created)
            setTimeout(() => {
              setShowProgressDialog(false);
              toast.success(`✅ ${data.missingFloorPlans} floor plans re-synced successfully`);
            }, 2000);
          }
        }
        
        setAlreadySyncedCount(data.verified || 0);
      } else {
        setShowProgressDialog(false);
        toast.error(data.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Verify error:', error);
      setShowProgressDialog(false);
      toast.error('Verification failed', {
        description: error.message
      });
    } finally {
      setVerifying(false);
    }
  };

  // FASE 5: Retry failed photos
  const handleRetryFailed = async () => {
    if (!selectedTourId) {
      toast.error('Select a tour');
      return;
    }

    try {
      // Reset failed items in queue for re-processing
      const { error } = await supabase
        .from('photo_sync_queue')
        .update({ 
          status: 'pending', 
          attempts: 0,
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('tour_id', selectedTourId)
        .eq('status', 'failed');

      if (error) throw error;

      toast.success('Failed photos queued for retry');
      
      // Trigger worker to process the queue
      await supabase.functions.invoke('photo-queue-worker', {});
      
    } catch (error) {
      console.error('Retry failed error:', error);
      toast.error('Failed to retry photos');
    }
  };

  const handleSyncAll = async () => {
    if (!selectedTourId) {
      toast.error('Select a tour');
      return;
    }

    setSyncingAll(true);
    setCurrentJob(null);
    setAlreadySyncedCount(0);
    setFloorPlanProgress(null);
    setFloorPlanErrors([]);
    setQuotaError(false); // Reset quota error

    try {
      // STEP 1: Sync Floor Plans
      toast.info('🗺️ Step 1/2: Syncing floor plans...');
      setSyncingFloorPlans(true);

      const floorPlansResult = await supabase.functions.invoke('sync-all-floor-plans', {
        body: {
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (floorPlansResult.error) throw floorPlansResult.error;

      if (floorPlansResult.data.success) {
        setFloorPlanProgress({
          synced: floorPlansResult.data.synced,
          failed: floorPlansResult.data.failed,
          total: floorPlansResult.data.total,
          alreadySynced: floorPlansResult.data.alreadySynced || 0
        });
        setFloorPlanErrors(floorPlansResult.data.errors || []);

        if (floorPlansResult.data.failed === 0) {
          toast.success(`✅ Step 1/2: ${floorPlansResult.data.synced} floor plans synced`);
        } else {
          toast.warning(`⚠️ Step 1/2: ${floorPlansResult.data.synced} floor plans synced, ${floorPlansResult.data.failed} failed`);
        }
      }

      setSyncingFloorPlans(false);

      // STEP 2: Sync Photos with job system
      toast.info('📸 Step 2/2: Syncing panoramic photos...');
      setSyncing(true);

      const photosResult = await supabase.functions.invoke('batch-sync-photos', {
        body: {
          action: 'start_job',
          tourId: selectedTourId,
          tenantId: tenantId
        }
      });

      if (photosResult.error) throw photosResult.error;

      if (photosResult.data.success && photosResult.data.jobId) {
        setAlreadySyncedCount(photosResult.data.alreadySynced || 0);
        setShowProgressDialog(true);
        toast.info(`🚀 Syncing ${photosResult.data.totalPhotos} photos...`);
        
        // Start polling for progress
        startPolling(photosResult.data.jobId);
      } else if (photosResult.data.success && !photosResult.data.jobId) {
        toast.info(photosResult.data.message);
      }

    } catch (error) {
      console.error('Sync all error:', error);
      toast.error(error instanceof Error ? error.message : 'Error during sync');
    } finally {
      setSyncing(false);
      setSyncingFloorPlans(false);
      setSyncingAll(false);
    }
  };

  const progressPercent = progress 
    ? ((progress.synced + progress.failed) / progress.total) * 100 
    : 0;

  return (
    <>
      <SyncProgressDialog 
        open={showProgressDialog}
        job={currentJob}
        alreadySynced={alreadySyncedCount}
        tourId={selectedTourId}
        onClose={() => setShowProgressDialog(false)}
        onCancel={handleCancelJob}
      />
      
      {quotaError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <div className="flex flex-col gap-2">
              <p className="font-semibold">Google Drive storage quota exceeded</p>
              <p className="text-sm">
                Your Google Drive is full. Please free up space or upgrade your storage plan to continue syncing.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-fit mt-2"
                onClick={() => window.open('https://drive.google.com/drive/quota', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Manage Google Drive Storage
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Sync Existing Photos
        </CardTitle>
        <CardDescription>
          Retroactively sync photos from a tour to Google Drive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-base md:text-sm font-medium">Select Tour</label>
          <Select
            value={selectedTourId}
            onValueChange={setSelectedTourId}
            disabled={loading || syncing || syncingFloorPlans || syncingAll || verifying}
          >
            <SelectTrigger className="h-11 md:h-10">
              <SelectValue placeholder="Select a tour..." />
            </SelectTrigger>
            <SelectContent>
              {tours.map(tour => (
                <SelectItem key={tour.id} value={tour.id}>
                  {tour.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button 
            onClick={handleSyncAll}
            disabled={!selectedTourId || syncingAll || verifying}
            className="w-full h-11 md:h-10"
            size="lg"
          >
            <Upload className="h-5 w-5 mr-2" />
            {syncingAll 
              ? syncingFloorPlans 
                ? "📍 Syncing floor plans..." 
                : syncing 
                  ? "📸 Syncing photos..." 
                  : "Syncing..."
              : "Sync All"
            }
          </Button>

          <Button 
            onClick={handleVerifyAndResync}
            disabled={!selectedTourId || syncingAll || verifying}
            variant="outline"
            className="w-full h-11 md:h-10"
            size="lg"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${verifying ? 'animate-spin' : ''}`} />
            {verifying ? "Verifying..." : "Verify Missing"}
          </Button>

          <Button 
            onClick={handleRetryFailed}
            disabled={!selectedTourId || syncingAll || verifying}
            variant="secondary"
            className="w-full h-11 md:h-10 md:col-span-2"
            size="lg"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Retry Failed Photos
          </Button>
        </div>

        {/* FASE 5: Queue Status Indicator */}
        {selectedTourId && (
          <QueueStatusIndicator tourId={selectedTourId} className="pt-2" />
        )}

        {progress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="font-semibold text-base md:text-sm">Panoramic Photos</div>
            <div className="space-y-2">
              <div className="flex justify-between text-base md:text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">
                  {progress.synced + progress.failed} / {progress.total} photos
                </span>
              </div>
              <Progress value={((progress.synced + progress.failed) / progress.total) * 100} className="h-2" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-base md:text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                <div className="text-green-600 dark:text-green-400 font-medium">✓ Synced</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{progress.synced}</div>
              </div>

              {progress.alreadySynced > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-blue-600 dark:text-blue-400 font-medium">⏭ Already synced</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{progress.alreadySynced}</div>
                </div>
              )}

              {progress.failed > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                  <div className="text-red-600 dark:text-red-400 font-medium">✗ Failed</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{progress.failed}</div>
                </div>
              )}
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Errors found:</div>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {errors.map((err, idx) => (
                      <li key={idx} className="font-mono">
                        Photo {err.photoId.slice(0, 8)}: {err.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {floorPlanProgress && (
          <div className="space-y-3 pt-4 border-t">
            <div className="font-semibold text-base md:text-sm">Floor Plans</div>
            <div className="space-y-2">
              <div className="flex justify-between text-base md:text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">
                  {floorPlanProgress.synced + floorPlanProgress.failed} / {floorPlanProgress.total} floor plans
                </span>
              </div>
              <Progress value={((floorPlanProgress.synced + floorPlanProgress.failed) / floorPlanProgress.total) * 100} className="h-2" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-base md:text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                <div className="text-green-600 dark:text-green-400 font-medium">✓ Synced</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{floorPlanProgress.synced}</div>
              </div>

              {floorPlanProgress.alreadySynced > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                  <div className="text-blue-600 dark:text-blue-400 font-medium">⏭ Already synced</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{floorPlanProgress.alreadySynced}</div>
                </div>
              )}

              {floorPlanProgress.failed > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                  <div className="text-red-600 dark:text-red-400 font-medium">✗ Failed</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">{floorPlanProgress.failed}</div>
                </div>
              )}
            </div>

            {floorPlanErrors.length > 0 && (
              <Alert variant="destructive">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-1">Errors found:</div>
                  <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                    {floorPlanErrors.map((error, idx) => (
                      <li key={idx} className="font-mono">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
};
