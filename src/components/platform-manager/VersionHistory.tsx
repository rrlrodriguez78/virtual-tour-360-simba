import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, GitBranch, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { PlatformUIConfig } from '@/hooks/usePlatformUIManagement';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface VersionHistoryProps {
  configs: PlatformUIConfig[];
  onRollback: (version: number) => void;
  onCompare: (v1: number, v2: number) => void;
  currentVersion?: number;
}

export function VersionHistory({ 
  configs, 
  onRollback, 
  onCompare,
  currentVersion 
}: VersionHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  const sortedConfigs = [...configs].sort((a, b) => b.version - a.version);

  const handleVersionSelect = (version: number) => {
    if (selectedVersions.includes(version)) {
      setSelectedVersions(selectedVersions.filter(v => v !== version));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, version]);
    } else {
      setSelectedVersions([selectedVersions[1], version]);
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      onCompare(selectedVersions[0], selectedVersions[1]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Version History</h3>
          <Badge variant="outline">{sortedConfigs.length} versions</Badge>
        </div>
        {selectedVersions.length === 2 && (
          <Button onClick={handleCompare} variant="outline" size="sm">
            Compare Selected
          </Button>
        )}
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {sortedConfigs.map((config) => (
            <Card 
              key={config.id}
              className={`cursor-pointer transition-all ${
                selectedVersions.includes(config.version) 
                  ? 'ring-2 ring-primary' 
                  : ''
              } ${
                config.version === currentVersion
                  ? 'border-primary'
                  : ''
              }`}
              onClick={() => handleVersionSelect(config.version)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={config.is_active ? 'default' : 'secondary'}>
                      v{config.version}
                    </Badge>
                    {config.version === currentVersion && (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Current
                      </Badge>
                    )}
                    {!config.is_active && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {config.version !== currentVersion && config.is_active && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rollback
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rollback to v{config.version}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will restore the configuration from version {config.version}.
                              The current version will be preserved in history.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onRollback(config.version)}>
                              Rollback
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {format(new Date(config.created_at), 'PPpp')}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Platform:</span>{' '}
                    <Badge variant="outline">{config.platform}</Badge>
                  </div>
                  <div>
                    <span className="font-medium">Page:</span>{' '}
                    {config.page_name}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Feature Flags</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(config.feature_flags as Record<string, boolean>).map(([key, value]) => (
                      <Badge 
                        key={key} 
                        variant={value ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Layout Config</div>
                  <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                    {Object.keys(config.layout_config as Record<string, any>).length} properties
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
