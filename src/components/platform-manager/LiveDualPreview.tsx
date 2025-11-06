import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LiveDualPreviewProps {
  pageName: string;
  layoutConfig: any;
  featureFlags: any;
  currentPlatform: 'web' | 'android';
}

export const LiveDualPreview = ({ 
  pageName, 
  layoutConfig, 
  featureFlags,
  currentPlatform 
}: LiveDualPreviewProps) => {
  const [showWeb, setShowWeb] = useState(true);
  const [showAndroid, setShowAndroid] = useState(true);

  const renderMockup = (platform: 'web' | 'android', isActive: boolean) => {
    const config = layoutConfig || {};
    const flags = featureFlags || {};

    return (
      <div className={cn("space-y-4 transition-opacity", !isActive && "opacity-50")}>
        {/* Header Mockup */}
        <div className={`bg-card border rounded-lg ${
          config.headerStyle === 'compact' ? 'p-2' : 
          config.headerStyle === 'extended' ? 'p-6' : 'p-4'
        }`}>
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm">{pageName}</div>
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

        {/* Content Grid Mockup */}
        <div className={`grid gap-${config.gap || 4} ${
          config.columns === 1 ? 'grid-cols-1' :
          config.columns === 2 ? 'grid-cols-2' :
          config.columns === 4 ? 'grid-cols-4' :
          'grid-cols-3'
        }`}>
          {Array.from({ length: Math.min(6, config.columns || 3) }).map((_, i) => (
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

        {/* Sidebar Mockup */}
        {config.showSidebar && (
          <div className={`flex gap-4 ${config.sidebarPosition === 'right' ? 'flex-row-reverse' : ''}`}>
            <div className="w-1/4 bg-muted rounded-lg h-32" />
            <div className="flex-1 bg-card border rounded-lg h-32" />
          </div>
        )}

        {/* Navigation Mockup */}
        {config.navigationStyle && config.navigationStyle !== 'default' && (
          <div className="flex gap-2 border-t pt-4">
            {['Home', 'Tours', 'Settings'].map(item => (
              <div
                key={item}
                className={`px-4 py-2 rounded-lg text-xs ${
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
        {platform === 'android' && flags.showFAB && (
          <div className="flex justify-end">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <div className="text-primary-foreground text-xl">+</div>
            </div>
          </div>
        )}

        {/* Active Features */}
        <div className="space-y-2 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground">Active Features:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(flags).filter(([_, value]) => value === true).length > 0 ? (
              Object.entries(flags).map(([key, value]) => 
                value === true && (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}
                  </Badge>
                )
              )
            ) : (
              <span className="text-xs text-muted-foreground">No features enabled</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Preview Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Live Preview</div>
        <div className="flex items-center gap-2">
          <Button
            variant={showWeb ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWeb(!showWeb)}
            className="h-8 gap-2"
          >
            {showWeb ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Web
          </Button>
          <Button
            variant={showAndroid ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAndroid(!showAndroid)}
            className="h-8 gap-2"
          >
            {showAndroid ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Android
          </Button>
        </div>
      </div>

      {/* Dual Preview Grid */}
      <div className={cn(
        "grid gap-4",
        showWeb && showAndroid ? "grid-cols-2" :
        showWeb || showAndroid ? "grid-cols-1" : "hidden"
      )}>
        {/* Web Preview */}
        {showWeb && (
          <Card className={cn(
            "border-2 transition-all",
            currentPlatform === 'web' 
              ? "border-blue-500 shadow-lg shadow-blue-500/20" 
              : "border-border"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  <CardTitle className="text-sm">Web Platform</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {currentPlatform === 'web' && (
                    <Badge variant="default" className="bg-blue-500">
                      Editing
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-blue-500">
                    Desktop
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="border rounded-lg p-6 bg-background">
                  {renderMockup('web', currentPlatform === 'web')}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Android Preview */}
        {showAndroid && (
          <Card className={cn(
            "border-2 transition-all",
            currentPlatform === 'android' 
              ? "border-green-500 shadow-lg shadow-green-500/20" 
              : "border-border"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-500" />
                  <CardTitle className="text-sm">Android Platform</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {currentPlatform === 'android' && (
                    <Badge variant="default" className="bg-green-500">
                      Editing
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-green-500">
                    Mobile
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ScrollArea className="h-[500px]">
                <div className="border rounded-lg max-w-sm p-4 bg-background">
                  {renderMockup('android', currentPlatform === 'android')}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Isolation Notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg p-3 bg-muted/50">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>
          Cambios en <strong>{currentPlatform === 'web' ? 'Web' : 'Android'}</strong> no afectarán a{' '}
          <strong>{currentPlatform === 'web' ? 'Android' : 'Web'}</strong> - Configuraciones aisladas
        </span>
      </div>
    </div>
  );
};
