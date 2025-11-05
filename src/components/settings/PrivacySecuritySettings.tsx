import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Key, Smartphone, Save, Check, X } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { validatePassword, checkPasswordStrength } from '@/lib/passwordValidation';

interface PrivacySecuritySettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
}

export const PrivacySecuritySettings = ({ settings, onUpdate }: PrivacySecuritySettingsProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [enabling2FA, setEnabling2FA] = useState(false);

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Contraseña actualizada exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('Error al cambiar la contraseña: ' + error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    try {
      setEnabling2FA(true);

      if (enabled) {
        // Enroll in MFA
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Authenticator App'
        });

        if (error) throw error;

        // Show QR code and secret to user
        if (data) {
          toast.success('Escanea el código QR con tu app de autenticación');
          // Here you would show a dialog with data.qr_code and data.secret
          // Security: Do not log sensitive 2FA data
          
          // For now, we'll update the setting
          onUpdate({ two_factor_enabled: enabled });
        }
      } else {
        // Get all factors
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        
        if (listError) throw listError;

        // Unenroll all factors
        if (factors && factors.totp && factors.totp.length > 0) {
          for (const factor of factors.totp) {
            const { error: unenrollError } = await supabase.auth.mfa.unenroll({
              factorId: factor.id
            });
            if (unenrollError) throw unenrollError;
          }
        }

        onUpdate({ two_factor_enabled: enabled });
        toast.success('Autenticación de dos factores desactivada');
      }
    } catch (error: any) {
      console.error('Error toggling 2FA:', error);
      toast.error('Error al configurar 2FA: ' + error.message);
    } finally {
      setEnabling2FA(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Privacidad y Seguridad</CardTitle>
        </div>
        <CardDescription>Gestiona tu privacidad y configuración de seguridad</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Change Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold">Cambiar Contraseña</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new_password">Nueva Contraseña</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 12 caracteres"
                className="mt-1"
              />
              
              {/* Password strength indicator */}
              {newPassword && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Requisitos de contraseña:</p>
                  {checkPasswordStrength(newPassword).map((check, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {check.met ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <X className="h-3 w-3 text-red-500" />
                      )}
                      <span className={check.met ? 'text-green-600' : 'text-muted-foreground'}>
                        {check.requirement}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirmar Contraseña</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contraseña"
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handlePasswordChange} 
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              {changingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
            </Button>
          </div>
        </div>

        <Separator />

        {/* 2FA Section */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <Label>Autenticación de Dos Factores (2FA)</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Agrega una capa extra de seguridad con una app de autenticación
            </p>
          </div>
          <Switch
            checked={settings.two_factor_enabled}
            onCheckedChange={handleToggle2FA}
            disabled={enabling2FA}
          />
        </div>

        <Separator />
        
        <div>
          <Label htmlFor="profile_visibility">Visibilidad del Perfil</Label>
          <Select 
            value={settings.profile_visibility} 
            onValueChange={(value) => onUpdate({ profile_visibility: value as any })}
          >
            <SelectTrigger id="profile_visibility" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Público</SelectItem>
              <SelectItem value="private">Privado</SelectItem>
              <SelectItem value="friends">Solo Amigos</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Controla quién puede ver tu perfil
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Compartir Datos</Label>
            <p className="text-xs text-muted-foreground">
              Compartir datos anónimos para mejorar el servicio
            </p>
          </div>
          <Switch
            checked={settings.data_sharing}
            onCheckedChange={(checked) => onUpdate({ data_sharing: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
};
