import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface SplitViewContextType {
  isWindowOpen: boolean;
  openSplitView: () => void;
  closeSplitView: () => void;
}

const SplitViewContext = createContext<SplitViewContextType | undefined>(undefined);

export const SplitViewProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const windowRef = useRef<Window | null>(null);

  const openSplitView = () => {
    const currentRoute = location.pathname + location.search;
    
    const width = 1600;
    const height = 900;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'status=no'
    ].join(',');

    windowRef.current = window.open(
      `/dev/split-view?route=${encodeURIComponent(currentRoute)}`,
      'SplitViewDev',
      features
    );

    if (windowRef.current) {
      setIsWindowOpen(true);
      windowRef.current.focus();

      const checkClosed = setInterval(() => {
        if (windowRef.current?.closed) {
          setIsWindowOpen(false);
          clearInterval(checkClosed);
        }
      }, 500);
    }
  };

  const closeSplitView = () => {
    if (windowRef.current && !windowRef.current.closed) {
      windowRef.current.close();
      setIsWindowOpen(false);
    }
  };

  // Sincronizar navegación con ventana popup (solo cuando cambia la ruta)
  useEffect(() => {
    if (isWindowOpen && windowRef.current && !windowRef.current.closed) {
      const channel = new BroadcastChannel('split-view-sync');
      const currentRoute = location.pathname + location.search;
      
      channel.postMessage({
        type: 'ROUTE_CHANGE',
        route: currentRoute
      });

      channel.close();
    }
  }, [location, isWindowOpen]);

  // Responder a solicitudes de ruta actual desde Split View
  useEffect(() => {
    const channel = new BroadcastChannel('split-view-sync');
    
    channel.onmessage = (event) => {
      if (event.data.type === 'REQUEST_CURRENT_ROUTE') {
        const currentRoute = location.pathname + location.search;
        channel.postMessage({
          type: 'CURRENT_ROUTE_RESPONSE',
          route: currentRoute
        });
      }
    };

    return () => channel.close();
  }, [location]);

  // Cleanup SOLO cuando la aplicación completa se cierra (unmount del provider)
  useEffect(() => {
    return () => {
      if (windowRef.current && !windowRef.current.closed) {
        windowRef.current.close();
      }
    };
  }, []);

  return (
    <SplitViewContext.Provider value={{ isWindowOpen, openSplitView, closeSplitView }}>
      {children}
    </SplitViewContext.Provider>
  );
};

export const useSplitView = () => {
  const context = useContext(SplitViewContext);
  if (!context) {
    throw new Error('useSplitView must be used within SplitViewProvider');
  }
  return context;
};
