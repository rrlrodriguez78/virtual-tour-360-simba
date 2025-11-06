import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Plus, Minus, RefreshCw } from 'lucide-react';
import { PlatformUIConfig } from '@/hooks/usePlatformUIManagement';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VersionComparisonProps {
  version1: PlatformUIConfig;
  version2: PlatformUIConfig;
}

export function VersionComparison({ version1, version2 }: VersionComparisonProps) {
  const compareObjects = (obj1: any, obj2: any) => {
    const changes: { key: string; type: 'added' | 'removed' | 'modified'; oldValue?: any; newValue?: any }[] = [];
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    allKeys.forEach(key => {
      if (!(key in obj1)) {
        changes.push({ key, type: 'added', newValue: obj2[key] });
      } else if (!(key in obj2)) {
        changes.push({ key, type: 'removed', oldValue: obj1[key] });
      } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        changes.push({ key, type: 'modified', oldValue: obj1[key], newValue: obj2[key] });
      }
    });

    return changes;
  };

  const featureFlagChanges = compareObjects(
    version1.feature_flags as Record<string, any>,
    version2.feature_flags as Record<string, any>
  );

  const layoutConfigChanges = compareObjects(
    version1.layout_config as Record<string, any>,
    version2.layout_config as Record<string, any>
  );

  const renderValue = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-500" />;
      case 'modified':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getChangeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      added: 'default',
      removed: 'destructive',
      modified: 'secondary'
    };
    return <Badge variant={variants[type]}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-center gap-4">
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Version {version1.version}</span>
              <Badge variant="outline">{version1.platform}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Created: {new Date(version1.created_at).toLocaleDateString()}
          </CardContent>
        </Card>

        <ArrowRight className="h-6 w-6 flex-shrink-0" />

        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Version {version2.version}</span>
              <Badge variant="outline">{version2.platform}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Created: {new Date(version2.created_at).toLocaleDateString()}
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-6">
          {/* Feature Flags Changes */}
          {featureFlagChanges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Feature Flags Changes
                  <Badge variant="outline">{featureFlagChanges.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {featureFlagChanges.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {getChangeIcon(change.type)}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{change.key}</code>
                          {getChangeBadge(change.type)}
                        </div>
                        {change.type === 'modified' && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="font-mono">
                              {renderValue(change.oldValue)}
                            </Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="default" className="font-mono">
                              {renderValue(change.newValue)}
                            </Badge>
                          </div>
                        )}
                        {change.type === 'added' && (
                          <Badge variant="default" className="font-mono">
                            {renderValue(change.newValue)}
                          </Badge>
                        )}
                        {change.type === 'removed' && (
                          <Badge variant="destructive" className="font-mono">
                            {renderValue(change.oldValue)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Layout Config Changes */}
          {layoutConfigChanges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Layout Configuration Changes
                  <Badge variant="outline">{layoutConfigChanges.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {layoutConfigChanges.map((change, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {getChangeIcon(change.type)}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{change.key}</code>
                          {getChangeBadge(change.type)}
                        </div>
                        {change.type === 'modified' && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="font-mono text-xs">
                              {renderValue(change.oldValue)}
                            </Badge>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="default" className="font-mono text-xs">
                              {renderValue(change.newValue)}
                            </Badge>
                          </div>
                        )}
                        {change.type === 'added' && (
                          <Badge variant="default" className="font-mono text-xs">
                            {renderValue(change.newValue)}
                          </Badge>
                        )}
                        {change.type === 'removed' && (
                          <Badge variant="destructive" className="font-mono text-xs">
                            {renderValue(change.oldValue)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {featureFlagChanges.length === 0 && layoutConfigChanges.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No differences found between these versions
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
