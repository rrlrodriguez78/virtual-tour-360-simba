import { lazy, ComponentType } from 'react';
import { usePlatform } from './usePlatform';

/**
 * Hook to dynamically load platform-specific components
 * 
 * @example
 * ```tsx
 * const Dashboard = usePlatformComponent('pages/Dashboard');
 * return <Dashboard />;
 * ```
 * 
 * This will try to load:
 * - pages/Dashboard.web.tsx for web
 * - pages/Dashboard.android.tsx for android
 * - pages/Dashboard.ios.tsx for ios
 * - Fallback to pages/Dashboard.tsx if platform-specific version doesn't exist
 */
export function usePlatformComponent<T = any>(basePath: string): ComponentType<T> | null {
  const { platform } = usePlatform();

  try {
    let Component: ComponentType<T>;

    switch (platform) {
      case 'android':
        try {
          Component = lazy(() => 
            import(`../${basePath}.android.tsx`).catch(() => 
              import(`../${basePath}.tsx`)
            )
          );
        } catch {
          Component = lazy(() => import(`../${basePath}.tsx`));
        }
        break;
      
      case 'ios':
        try {
          Component = lazy(() => 
            import(`../${basePath}.ios.tsx`).catch(() => 
              import(`../${basePath}.tsx`)
            )
          );
        } catch {
          Component = lazy(() => import(`../${basePath}.tsx`));
        }
        break;
      
      case 'web':
      default:
        try {
          Component = lazy(() => 
            import(`../${basePath}.web.tsx`).catch(() => 
              import(`../${basePath}.tsx`)
            )
          );
        } catch {
          Component = lazy(() => import(`../${basePath}.tsx`));
        }
        break;
    }

    return Component;
  } catch (error) {
    console.error(`Failed to load component: ${basePath}`, error);
    return null;
  }
}

/**
 * Helper to conditionally render platform-specific content inline
 * 
 * @example
 * ```tsx
 * const content = usePlatformContent({
 *   web: <WebVersion />,
 *   android: <AndroidVersion />,
 *   fallback: <DefaultVersion />
 * });
 * 
 * return <>{content}</>;
 * ```
 */
export function usePlatformContent<T = React.ReactNode>(content: {
  web?: T;
  android?: T;
  ios?: T;
  fallback?: T;
}): T | null {
  const { platform } = usePlatform();

  switch (platform) {
    case 'android':
      return content.android ?? content.fallback ?? null;
    case 'ios':
      return content.ios ?? content.fallback ?? null;
    case 'web':
    default:
      return content.web ?? content.fallback ?? null;
  }
}
