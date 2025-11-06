import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlatformPreviewProps {
  pageName: string;
  layoutConfig: any;
  featureFlags: any;
}

export const PlatformPreview = ({ pageName, layoutConfig, featureFlags }: PlatformPreviewProps) => {
  const renderMockup = (platform: 'web' | 'android' | 'ios') => {
    const config = layoutConfig || {};
    const flags = featureFlags || {};

    return (
      <div className="space-y-4">
        {/* Header Mockup */}
        <div className={`bg-card border rounded-lg ${
          config.headerStyle === 'compact' ? 'p-2' : 
          config.headerStyle === 'extended' ? 'p-6' : 'p-4'
        }`}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{pageName}</div>
            <div className="flex gap-2">
              {flags.showSearch && (
                <Badge variant="outline" className="text-xs">Search</Badge>
              )}
              {flags.showShareButton && (
                <Badge variant="outline" className="text-xs">Share</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content Mockup */}
        <div className={`grid gap-${config.gap || 'md'} ${
          config.columns === 1 ? 'grid-cols-1' :
          config.columns === 2 ? 'grid-cols-2' :
          config.columns === 4 ? 'grid-cols-4' :
          'grid-cols-3'
        }`}>
          {[1, 2, 3, 4, 5, 6].slice(0, config.columns || 3).map(i => (
            <div
              key={i}
              className={`bg-muted rounded-lg ${
                config.cardSize === 'sm' ? 'h-20' :
                config.cardSize === 'lg' ? 'h-40' :
                'h-28'
              }`}
            />
          ))}
        </div>

        {/* Navigation Mockup */}
        {config.navigationStyle && (
          <div className="flex gap-2 border-t pt-4">
            {['Home', 'Tours', 'Settings'].map(item => (
              <div
                key={item}
                className={`px-4 py-2 rounded-lg text-sm ${
                  config.navigationStyle === 'pills' ? 'bg-muted' :
                  config.navigationStyle === 'underline' ? 'border-b-2 border-primary' :
                  'bg-background border'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {/* FAB for mobile */}
        {platform !== 'web' && flags.showFAB && (
          <div className="fixed bottom-4 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center">
            <div className="text-primary-foreground text-2xl">+</div>
          </div>
        )}

        {/* Features List */}
        <div className="mt-6 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Active Features:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(flags).map(([key, value]) => 
              value === true && (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}
                </Badge>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Preview</CardTitle>
        <CardDescription>Visual representation of configuration</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="web" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="web">
              <Monitor className="h-4 w-4 mr-2" />
              Web
            </TabsTrigger>
            <TabsTrigger value="android">
              <Smartphone className="h-4 w-4 mr-2" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios">
              <Tablet className="h-4 w-4 mr-2" />
              iOS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="web" className="mt-4">
            <div className="border-2 rounded-lg p-6 bg-background">
              {renderMockup('web')}
            </div>
          </TabsContent>

          <TabsContent value="android" className="mt-4">
            <div className="border-2 rounded-lg max-w-sm mx-auto p-4 bg-background">
              {renderMockup('android')}
            </div>
          </TabsContent>

          <TabsContent value="ios" className="mt-4">
            <div className="border-2 rounded-lg max-w-sm mx-auto p-4 bg-background">
              {renderMockup('ios')}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
