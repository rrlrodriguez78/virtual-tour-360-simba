import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Lock, ShieldAlert } from 'lucide-react';

interface TourPasswordPromptProps {
  open: boolean;
  tourId: string;
  tourTitle: string;
  onSuccess: (passwordUpdatedAt: string) => void;
}

export const TourPasswordPrompt = ({ 
  open, 
  tourId, 
  tourTitle,
  onSuccess 
}: TourPasswordPromptProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      toast({
        title: t('tourPassword.incorrectPassword'),
        description: t('tourPassword.enterPassword'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-tour-password', {
        body: { tour_id: tourId, password },
      });

      if (error || !data?.success) {
        toast({
          title: t('tourPassword.incorrectPassword'),
          description: 'La contraseña ingresada no es correcta',
          variant: 'destructive',
        });
        setPassword('');
        return;
      }

      // Store signed JWT access token from server
      if (data.access_token) {
        localStorage.setItem(`tour_access_${tourId}`, data.access_token);
      }

      toast({
        title: 'Acceso concedido',
        description: 'Contraseña correcta',
      });

      onSuccess(data.password_updated_at);
    } catch (error) {
      console.error('Error verifying password:', error);
      toast({
        title: 'Error',
        description: 'No se pudo verificar la contraseña',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            {t('tourPassword.passwordRequired')}
          </DialogTitle>
          <DialogDescription>
            {t('tourPassword.passwordPrompt')} "{tourTitle}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tour-password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Contraseña
              </Label>
              <Input
                id="tour-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa la contraseña del tour"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verificando...' : 'Acceder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};