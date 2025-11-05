import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, Lock } from "lucide-react";
import { Navbar } from "@/components/Navbar";

export default function SharedTour() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateAndRedirect = async () => {
      if (!token) {
        setError("Token inválido");
        setLoading(false);
        return;
      }

      try {
        // Verify JWT using edge function
        const { data, error } = await supabase.functions.invoke('verify-tour-jwt', {
          body: { jwt: token }
        });

        if (error || !data.valid) {
          const errorMessage = data?.reason === 'expired' 
            ? "Este link ha expirado"
            : data?.reason === 'max_views_exceeded'
            ? "Este link ha alcanzado su límite de vistas"
            : data?.reason === 'share_not_found'
            ? "Link de compartir inválido o desactivado"
            : "Link de compartir inválido o expirado";
          
          setError(errorMessage);
          setLoading(false);
          return;
        }

        // Redirect to viewer with verified JWT
        navigate(`/viewer/${data.tour.id}?share=${token}`);
      } catch (err) {
        console.error('Error validating share:', err);
        setError("Error al validar el link de compartir");
        setLoading(false);
      }
    };

    validateAndRedirect();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Verificando acceso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-16">
        <Navbar />
        <div className="container mx-auto p-6 max-w-md mt-20">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error de acceso</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Lock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Si crees que esto es un error, contacta a quien compartió este link contigo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}