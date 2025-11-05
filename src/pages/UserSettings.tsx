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
  RefreshCw,
  Volume2,
  BarChart3,
  CreditCard
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationsList } from '@/components/settings/NotificationsList';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { LanguageRegionSettings } from '@/components/settings/LanguageRegionSettings';
import { PrivacySecuritySettings } from '@/components/settings/PrivacySecuritySettings';
import { MobileSettings } from '@/components/settings/MobileSettings';
import { SyncSettings } from '@/components/settings/SyncSettings';
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
  const [loading, setLoading] = useState(false);
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
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error saving profile');
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
          onClick={() => navigate('/app/tours')}
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
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10 mb-8">
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
            <TabsTrigger value="sync" className="gap-1">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Sync</span>
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
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback>
                      {profile.full_name?.charAt(0) || profile.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Label htmlFor="avatar_url">Avatar URL</Label>
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

          <TabsContent value="sync">
            <SyncSettings settings={settings} onUpdate={updateSettings} />
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
    </div>
  );
};

export default UserSettings;
