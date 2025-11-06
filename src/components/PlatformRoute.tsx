import { ComponentType, lazy, Suspense } from 'react';
import { usePlatform, usePlatformConfig } from '@/hooks/usePlatform';

interface PlatformRouteElementProps {
  webComponent?: ComponentType<any>;
  androidComponent?: ComponentType<any>;
  iosComponent?: ComponentType<any>;
  fallback?: ComponentType<any>;
  pageName: string;
}

export function PlatformRouteElement({
  webComponent,
  androidComponent,
  iosComponent,
  fallback,
  pageName,
}: PlatformRouteElementProps) {
  const { platform } = usePlatform();
  const { data: config, isLoading } = usePlatformConfig(pageName);

  // Determine which component to render
  const getComponent = (): ComponentType<any> | null => {
    // If there's a database configuration with a custom component path, use it
    if (config && config.component_path && config.component_path !== '') {
      try {
        // Dynamic import based on component_path from database
        const DynamicComponent = lazy(() => import(`../${config.component_path}`));
        return DynamicComponent;
      } catch (error) {
        console.error(`Failed to load component from path: ${config.component_path}`, error);
      }
    }

    // Try to load platform-specific variant automatically
    // Example: pages/Dashboard.tsx -> pages/Dashboard.web.tsx or pages/Dashboard.android.tsx
    if (webComponent || androidComponent || iosComponent) {
      try {
        // Extract the base path from provided components
        const basePath = pageName;
        
        // Try to load platform-specific variant
        switch (platform) {
          case 'android':
            if (androidComponent) return androidComponent;
            // Try to load .android.tsx variant
            try {
              const AndroidVariant = lazy(() => import(`../pages/${basePath}.android.tsx`).catch(() => import(`../pages/${basePath}.tsx`)));
              return AndroidVariant;
            } catch {
              return fallback || webComponent || null;
            }
          case 'ios':
            if (iosComponent) return iosComponent;
            // Try to load .ios.tsx variant
            try {
              const IOSVariant = lazy(() => import(`../pages/${basePath}.ios.tsx`).catch(() => import(`../pages/${basePath}.tsx`)));
              return IOSVariant;
            } catch {
              return fallback || webComponent || null;
            }
          case 'web':
          default:
            if (webComponent) return webComponent;
            // Try to load .web.tsx variant
            try {
              const WebVariant = lazy(() => import(`../pages/${basePath}.web.tsx`).catch(() => import(`../pages/${basePath}.tsx`)));
              return WebVariant;
            } catch {
              return fallback || null;
            }
         }
      } catch (error) {
        console.error(`Failed to load platform variant for: ${pageName}`, error);
      }
    }

    // Final fallback: use provided platform-specific components
    switch (platform) {
      case 'android':
        return androidComponent || fallback || webComponent || null;
      case 'ios':
        return iosComponent || fallback || webComponent || null;
      case 'web':
      default:
        return webComponent || fallback || null;
    }
  };

  const Component = getComponent();

  if (!Component) {
    console.error(`No component found for page: ${pageName} on platform: ${platform}`);
    return null;
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>}>
      <Component />
    </Suspense>
  );
}

// Helper component for platform-specific rendering within a page
interface PlatformAdaptiveProps {
  web?: React.ReactNode;
  android?: React.ReactNode;
  ios?: React.ReactNode;
  shared?: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PlatformAdaptive({
  web,
  android,
  ios,
  shared,
  fallback,
}: PlatformAdaptiveProps) {
  const { platform } = usePlatform();

  const getContent = () => {
    switch (platform) {
      case 'android':
        return android || shared || fallback || null;
      case 'ios':
        return ios || shared || fallback || null;
      case 'web':
      default:
        return web || shared || fallback || null;
    }
  };

  return <>{getContent()}</>;
}
