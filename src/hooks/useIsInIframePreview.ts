import { useEffect, useState } from 'react';

/**
 * Hook para detectar si la página está siendo cargada en modo preview dentro de un iframe del Split View.
 * Este modo permite saltarse validaciones de permisos para propósitos de desarrollo.
 */
export const useIsInIframePreview = () => {
  const [isInIframePreview, setIsInIframePreview] = useState(false);

  useEffect(() => {
    // Detectar parámetro URL
    const params = new URLSearchParams(window.location.search);
    const isPreview = params.get('iframe_preview') === 'true';
    
    // Verificar si está en iframe
    const inIframe = window.self !== window.top;
    
    // Solo activar si AMBAS condiciones son verdaderas
    setIsInIframePreview(isPreview && inIframe);
  }, []);

  return isInIframePreview;
};
