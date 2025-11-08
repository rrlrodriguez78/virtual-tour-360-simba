import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Palette, 
  Mail, 
  Save,
  Globe,
  Shield,
  Smartphone,
  Volume2,
  BarChart3,
  CreditCard,
  Camera,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { AvatarEditor } from '@/components/settings/AvatarEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationsList } from '@/components/settings/NotificationsList';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { LanguageRegionSettings } from '@/components/settings/LanguageRegionSettings';
import { PrivacySecuritySettings } from '@/components/settings/PrivacySecuritySettings';
import { MobileSettings } from '@/components/settings/MobileSettings';
import { AudioVideoSettings } from '@/components/settings/AudioVideoSettings';
import { AnalyticsSettings } from '@/components/settings/AnalyticsSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { SettingsAccessAudit } from '@/components/settings/SettingsAccessAudit';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

const UserSettings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading, updateSettings } = useUserSettingsContext();
  const { isSuperAdmin } = useIsSuperAdmin();
  const { takePicture, pickFromGallery, loading: cameraLoading } = useNativeCamera();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string>('');
  const [profile, setProfile] = useState({
    email: '',
    full_name: '',
    avatar_url: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      setProfile({
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const uploadAvatarBlob = async (blob: Blob) => {
    if (!user) return null;

    try {
      setUploadingPhoto(true);

      // Upload to Supabase Storage
      const fileName = `${user.id}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('tour-images')
        .upload(`avatars/${fileName}`, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(`avatars/${fileName}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Error al subir la foto');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await takePicture();
      if (result?.base64) {
        // Convert base64 to data URL
        const dataUrl = result.base64.startsWith('data:') 
          ? result.base64 
          : `data:image/${result.format};base64,${result.base64}`;
        
        setTempImageUrl(dataUrl);
        setEditorOpen(true);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      toast.error('Error al capturar la foto');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await pickFromGallery();
      if (result?.base64) {
        // Convert base64 to data URL
        const dataUrl = result.base64.startsWith('data:') 
          ? result.base64 
          : `data:image/${result.format};base64,${result.base64}`;
        
        setTempImageUrl(dataUrl);
        setEditorOpen(true);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      toast.error('Error al seleccionar la foto');
    }
  };

  const handleSaveCroppedImage = async (croppedBlob: Blob) => {
    const publicUrl = await uploadAvatarBlob(croppedBlob);
    if (publicUrl && user) {
      try {
        // Update profile state
        setProfile({ ...profile, avatar_url: publicUrl });
        
        // Save to database immediately
        const { error } = await supabase.auth.updateUser({
          data: {
            avatar_url: publicUrl,
          }
        });

        if (error) throw error;
        
        setEditorOpen(false);
        toast.success('Foto de perfil actualizada correctamente');
      } catch (error) {
        console.error('Error saving avatar:', error);
        toast.error('Error al guardar la foto de perfil');
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }
      });

      if (error) throw error;
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error al guardar el perfil');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <User className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Customize your application experience
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9 mb-8">
            <TabsTrigger value="profile" className="gap-1">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="language" className="gap-1">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Language</span>
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-1">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="mobile" className="gap-1">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Mobile</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1">
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Media</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1">
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">My Profile</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="text-2xl">
                        {profile.full_name?.charAt(0) || profile.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Label>Foto de Perfil</Label>
                      <p className="text-xs text-muted-foreground">
                        Toma una foto o selecciona desde tu galería
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTakePhoto}
                          disabled={uploadingPhoto || cameraLoading}
                        >
                          {uploadingPhoto ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4 mr-2" />
                          )}
                          Tomar Foto
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handlePickFromGallery}
                          disabled={uploadingPhoto || cameraLoading}
                        >
                          {uploadingPhoto ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4 mr-2" />
                          )}
                          Galería
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="avatar_url" className="text-xs text-muted-foreground">
                      O ingresa una URL de imagen
                    </Label>
                    <Input
                      id="avatar_url"
                      value={profile.avatar_url}
                      onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                      placeholder="https://example.com/avatar.jpg"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Your full name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={profile.email}
                      disabled
                      className="opacity-60"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be modified
                  </p>
                </div>

                <Button 
                  onClick={handleSaveProfile} 
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettings settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="language">
            <LanguageRegionSettings settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="privacy">
            <div className="space-y-6">
              <PrivacySecuritySettings settings={settings} onUpdate={updateSettings} />
              {isSuperAdmin && <SettingsAccessAudit />}
            </div>
          </TabsContent>

          <TabsContent value="mobile">
            <div className="space-y-6">
              <MobileSettings settings={settings} onUpdate={updateSettings} />
            </div>
          </TabsContent>

          <TabsContent value="media">
            <AudioVideoSettings settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsSettings settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettings settings={settings} onUpdate={updateSettings} />
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <NotificationsList />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Notification Settings</CardTitle>
                  <CardDescription>
                    Customize how and when you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationSettings />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AvatarEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        imageUrl={tempImageUrl}
        onSave={handleSaveCroppedImage}
      />
    </div>
  );
};

export default UserSettings;
