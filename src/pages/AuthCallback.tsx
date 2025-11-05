import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');

    // Edge function handles OAuth flow and redirects with success/error params
    if (oauthSuccess === 'true') {
      setStatus('success');
      setTimeout(() => navigate('/app/backups?oauth_success=true'), 2000);
      return;
    }

    if (oauthError === 'true' || oauthError) {
      setStatus('error');
      setErrorMessage(oauthError === 'true' ? 'Error al conectar con el proveedor' : oauthError);
      setTimeout(() => navigate('/app/backups?oauth_error=true'), 3000);
      return;
    }

    // Fallback: no valid params
    setStatus('error');
    setErrorMessage('Parámetros de autenticación inválidos');
    setTimeout(() => navigate('/app/backups'), 3000);
  }, [navigate]);


  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
            {status === 'loading' && 'Procesando autenticación...'}
            {status === 'success' && '¡Conexión exitosa!'}
            {status === 'error' && 'Error de autenticación'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Conectando con Google Drive...'}
            {status === 'success' && 'Tu cuenta de Google Drive ha sido conectada exitosamente'}
            {status === 'error' && 'No se pudo completar la autenticación'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Por favor espera mientras procesamos tu solicitud...
              </p>
            </div>
          )}
          
          {status === 'success' && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Redirigiendo a la página de backups...
              </AlertDescription>
            </Alert>
          )}
          
          {status === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage}
                <br />
                <span className="text-sm">Redirigiendo...</span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
