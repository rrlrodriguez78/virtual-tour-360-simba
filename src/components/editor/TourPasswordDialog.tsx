import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Lock } from 'lucide-react';

interface TourPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  isProtected: boolean;
  onSuccess: () => void;
}

export const TourPasswordDialog = ({ 
  open, 
  onOpenChange, 
  tourId, 
  isProtected,
  onSuccess 
}: TourPasswordDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(isProtected);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (enabled && !password) {
      toast({
        title: t('tourPassword.incorrectPassword'),
        description: t('tourPassword.enterPassword'),
        variant: 'destructive',
      });
      return;
    }

    if (enabled && password.length < 6) {
      toast({
        title: t('tourPassword.incorrectPassword'),
        description: t('tourPassword.minLength'),
        variant: 'destructive',
      });
      return;
    }

    if (enabled && password !== confirmPassword) {
      toast({
        title: t('tourPassword.incorrectPassword'),
        description: t('tourPassword.passwordMismatch'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Security: Do not log password data
      
      const { data, error } = await supabase.functions.invoke('set-tour-password', {
        body: { tour_id: tourId, password, enabled },
      });

      if (error) {
        console.error('❌ Error de la edge function:', error);
        toast({
          title: 'Error',
          description: error.message || 'No se pudo configurar la contraseña',
          variant: 'destructive',
        });
        return;
      }

      if (!data || !data.success) {
        console.error('❌ Operación no exitosa:', data);
        toast({
          title: 'Error',
          description: 'La operación no se completó correctamente',
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Contraseña configurada exitosamente');
      toast({
        title: enabled ? t('tourPassword.passwordSet') : t('tourPassword.passwordRemoved'),
        description: enabled 
          ? 'La contraseña ha sido configurada correctamente' 
          : 'La protección con contraseña ha sido desactivada',
      });

      onSuccess();
      onOpenChange(false);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('💥 Error inesperado:', error);
      toast({
        title: 'Error',
        description: 'No se pudo configurar la contraseña',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('tourPassword.title')}
          </DialogTitle>
          <DialogDescription>
            Configura una contraseña para proteger el acceso a este tour público
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="password-protected" className="flex flex-col space-y-1">
              <span>{t('tourPassword.enable')}</span>
              <span className="text-sm font-normal text-muted-foreground">
                Los visitantes necesitarán una contraseña
              </span>
            </Label>
            <Switch
              id="password-protected"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">{t('tourPassword.enterPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('tourPassword.confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirma la contraseña"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};