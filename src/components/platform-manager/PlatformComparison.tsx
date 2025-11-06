import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Monitor, Smartphone, Tablet } from 'lucide-react';
import { usePlatformUIConfigs } from '@/hooks/usePlatformUIManagement';

interface PlatformComparisonProps {
  pageName: string;
}

export const PlatformComparison = ({ pageName }: PlatformComparisonProps) => {
  const { data: configs, isLoading } = usePlatformUIConfigs();

  if (isLoading) {
    return <div className="animate-pulse">Loading comparison...</div>;
  }

  const pageConfigs = configs?.filter(c => c.page_name === pageName) || [];
  const webConfig = pageConfigs.find(c => c.platform === 'web');
  const androidConfig = pageConfigs.find(c => c.platform === 'android');
  // iOS support - currently 'both' covers mobile platforms
  const iosConfig = pageConfigs.find(c => c.platform === 'both');

  const allFeatures = new Set<string>();
  [webConfig, androidConfig, iosConfig].forEach(config => {
    if (config?.feature_flags) {
      Object.keys(config.feature_flags).forEach(key => allFeatures.add(key));
    }
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'web':
        return <Monitor className="h-4 w-4" />;
      case 'android':
        return <Smartphone className="h-4 w-4" />;
      case 'ios':
        return <Tablet className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Platform Comparison</CardTitle>
        <CardDescription>Side-by-side feature comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Monitor className="h-4 w-4" />
                Web
              </div>
              <Badge variant={webConfig?.is_active ? 'default' : 'secondary'}>
                {webConfig?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4" />
                Android
              </div>
              <Badge variant={androidConfig?.is_active ? 'default' : 'secondary'}>
                {androidConfig?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Tablet className="h-4 w-4" />
                iOS
              </div>
              <Badge variant={iosConfig?.is_active ? 'default' : 'secondary'}>
                {iosConfig?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Feature Flags Comparison */}
          {allFeatures.size > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Feature Flags</div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Feature</th>
                      <th className="text-center p-2">
                        <Monitor className="h-4 w-4 mx-auto" />
                      </th>
                      <th className="text-center p-2">
                        <Smartphone className="h-4 w-4 mx-auto" />
                      </th>
                      <th className="text-center p-2">
                        <Tablet className="h-4 w-4 mx-auto" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(allFeatures).map(feature => (
                      <tr key={feature} className="border-t">
                        <td className="p-2 font-mono text-xs">{feature}</td>
                        <td className="p-2 text-center">
                          {webConfig?.feature_flags?.[feature] ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {androidConfig?.feature_flags?.[feature] ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {iosConfig?.feature_flags?.[feature] ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Layout Comparison */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Layout Configuration</div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              {[
                { config: webConfig, icon: <Monitor className="h-3 w-3" /> },
                { config: androidConfig, icon: <Smartphone className="h-3 w-3" /> },
                { config: iosConfig, icon: <Tablet className="h-3 w-3" /> }
              ].map(({ config, icon }, idx) => (
                <div key={idx} className="space-y-1 p-2 border rounded">
                  <div className="flex items-center gap-1 font-medium mb-2">
                    {icon}
                  </div>
                  {config?.layout_config ? (
                    <div className="space-y-1 text-muted-foreground">
                      <div>Columns: {config.layout_config.columns || 'default'}</div>
                      <div>Gap: {config.layout_config.gap || 'default'}</div>
                      <div>Style: {config.layout_config.headerStyle || 'default'}</div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No config</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
