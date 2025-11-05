import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navbar } from '@/components/Navbar';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Flag, Users, Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Feature {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string | null;
  version: string;
  is_beta: boolean;
  requires_subscription_tier: string;
  created_at: string;
}

interface GlobalConfig {
  id: string;
  feature_id: string;
  default_enabled: boolean;
  rollout_percentage: number;
}

interface Tenant {
  id: string;
  name: string;
}

interface TenantFeature {
  tenant_id: string;
  feature_id: string;
  enabled: boolean;
  tenant_name?: string;
}

export default function FeatureManagement() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: loadingAdmin } = useIsSuperAdmin();
  const navigate = useNavigate();

  const [features, setFeatures] = useState<Feature[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<GlobalConfig[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeature[]>([]);
  const [loading, setLoading] = useState(true);

  // New feature form
  const [showNewFeatureDialog, setShowNewFeatureDialog] = useState(false);
  const [newFeature, setNewFeature] = useState({
    feature_key: '',
    feature_name: '',
    description: '',
    version: '1.0.0',
    is_beta: false,
    requires_subscription_tier: 'free'
  });

  useEffect(() => {
    // Wait for both auth and admin checks to complete
    if (!authLoading && !loadingAdmin) {
      if (!user) {
        navigate('/login');
      } else if (!isSuperAdmin) {
        navigate('/app/inicio');
      }
    }
  }, [user, authLoading, loadingAdmin, isSuperAdmin, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load features
      const { data: featuresData, error: featuresError } = await supabase
        .from('features')
        .select('*')
        .order('created_at', { ascending: false });

      if (featuresError) throw featuresError;
      setFeatures(featuresData || []);

      // Load global configs
      const { data: configsData, error: configsError } = await supabase
        .from('global_feature_config')
        .select('*');

      if (configsError) throw configsError;
      setGlobalConfigs(configsData || []);

      // Load tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Load tenant features
      const { data: tenantFeaturesData, error: tenantFeaturesError } = await supabase
        .from('tenant_features')
        .select('tenant_id, feature_id, enabled');

      if (tenantFeaturesError) throw tenantFeaturesError;
      setTenantFeatures(tenantFeaturesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const createFeature = async () => {
    try {
      const { data, error } = await supabase
        .from('features')
        .insert([newFeature])
        .select()
        .single();

      if (error) throw error;

      // Create global config for new feature
      await supabase
        .from('global_feature_config')
        .insert([{
          feature_id: data.id,
          default_enabled: false,
          rollout_percentage: 0
        }]);

      toast.success('Feature created successfully');
      setShowNewFeatureDialog(false);
      setNewFeature({
        feature_key: '',
        feature_name: '',
        description: '',
        version: '1.0.0',
        is_beta: false,
        requires_subscription_tier: 'free'
      });
      loadData();
    } catch (error) {
      console.error('Error creating feature:', error);
      toast.error('Error creating feature');
    }
  };

  const updateGlobalConfig = async (featureId: string, updates: Partial<GlobalConfig>) => {
    try {
      const { error } = await supabase
        .from('global_feature_config')
        .update(updates)
        .eq('feature_id', featureId);

      if (error) throw error;

      toast.success('Configuration updated');
      loadData();
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Error updating configuration');
    }
  };

  const toggleTenantFeature = async (tenantId: string, featureId: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('tenant_features')
        .update({ enabled: !currentEnabled, enabled_at: !currentEnabled ? new Date().toISOString() : null })
        .eq('tenant_id', tenantId)
        .eq('feature_id', featureId);

      if (error) throw error;

      toast.success('Feature updated for tenant');
      loadData();
    } catch (error) {
      console.error('Error toggling tenant feature:', error);
      toast.error('Error updating tenant feature');
    }
  };

  const deleteFeature = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature?')) return;

    try {
      const { error } = await supabase
        .from('features')
        .delete()
        .eq('id', featureId);

      if (error) throw error;

      toast.success('Feature deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting feature:', error);
      toast.error('Error deleting feature');
    }
  };

  const getGlobalConfig = (featureId: string) => {
    return globalConfigs.find(c => c.feature_id === featureId);
  };

  const getTenantFeatureStatus = (tenantId: string, featureId: string) => {
    return tenantFeatures.find(tf => tf.tenant_id === tenantId && tf.feature_id === featureId);
  };

  const getFeatureStats = (featureId: string) => {
    const enabled = tenantFeatures.filter(tf => tf.feature_id === featureId && tf.enabled).length;
    const total = tenants.length;
    return { enabled, total, percentage: total > 0 ? Math.round((enabled / total) * 100) : 0 };
  };

  if (loadingAdmin || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You don't have permission to access this page.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto pt-24 pb-8 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Feature Management</h1>
            <p className="text-muted-foreground">Feature control per tenant</p>
          </div>
          <Dialog open={showNewFeatureDialog} onOpenChange={setShowNewFeatureDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Feature
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Feature</DialogTitle>
                <DialogDescription>
                  Define a new feature to control its availability
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Feature Key *</Label>
                  <Input
                    value={newFeature.feature_key}
                    onChange={(e) => setNewFeature({ ...newFeature, feature_key: e.target.value })}
                    placeholder="advanced_analytics"
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={newFeature.feature_name}
                    onChange={(e) => setNewFeature({ ...newFeature, feature_name: e.target.value })}
                    placeholder="Advanced Analytics"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newFeature.description}
                    onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                    placeholder="Feature description..."
                  />
                </div>
                <div>
                  <Label>Version</Label>
                  <Input
                    value={newFeature.version}
                    onChange={(e) => setNewFeature({ ...newFeature, version: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Required Tier</Label>
                  <Select
                    value={newFeature.requires_subscription_tier}
                    onValueChange={(value) => setNewFeature({ ...newFeature, requires_subscription_tier: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newFeature.is_beta}
                    onCheckedChange={(checked) => setNewFeature({ ...newFeature, is_beta: checked })}
                  />
                  <Label>Beta Feature</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewFeatureDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createFeature}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="features">
          <TabsList>
            <TabsTrigger value="features">
              <Flag className="w-4 h-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger value="global">
              <Globe className="w-4 h-4 mr-2" />
              Global Config
            </TabsTrigger>
            <TabsTrigger value="tenants">
              <Users className="w-4 h-4 mr-2" />
              By Tenant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-4">
            {features.map((feature) => {
              const stats = getFeatureStats(feature.id);
              return (
                <Card key={feature.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {feature.feature_name}
                          {feature.is_beta && <Badge variant="secondary">Beta</Badge>}
                          <Badge variant="outline">{feature.requires_subscription_tier}</Badge>
                        </CardTitle>
                        <CardDescription>
                          <code className="text-xs">{feature.feature_key}</code> • v{feature.version}
                        </CardDescription>
                        {feature.description && (
                          <p className="text-sm text-muted-foreground mt-2">{feature.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFeature(feature.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-medium">Adoption</div>
                        <div className="text-2xl font-bold">{stats.percentage}%</div>
                        <div className="text-xs text-muted-foreground">
                          {stats.enabled} of {stats.total} tenants
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="global" className="space-y-4">
            {features.map((feature) => {
              const config = getGlobalConfig(feature.id);
              if (!config) return null;

              return (
                <Card key={feature.id}>
                  <CardHeader>
                    <CardTitle>{feature.feature_name}</CardTitle>
                    <CardDescription>Configuration for new tenants</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enabled by default</Label>
                        <p className="text-xs text-muted-foreground">
                          New tenants will have this feature active
                        </p>
                      </div>
                      <Switch
                        checked={config.default_enabled}
                        onCheckedChange={(checked) =>
                          updateGlobalConfig(feature.id, { default_enabled: checked })
                        }
                      />
                    </div>
                    <div>
                      <Label>Rollout Percentage: {config.rollout_percentage}%</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Activation probability for new tenants
                      </p>
                      <Slider
                        value={[config.rollout_percentage]}
                        onValueChange={([value]) =>
                          updateGlobalConfig(feature.id, { rollout_percentage: value })
                        }
                        max={100}
                        step={5}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="tenants" className="space-y-4">
            {tenants.map((tenant) => (
              <Card key={tenant.id}>
                <CardHeader>
                  <CardTitle>{tenant.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {features.map((feature) => {
                      const status = getTenantFeatureStatus(tenant.id, feature.id);
                      const enabled = status?.enabled || false;

                      return (
                        <div key={feature.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <div className="font-medium">{feature.feature_name}</div>
                            <div className="text-xs text-muted-foreground">{feature.feature_key}</div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => toggleTenantFeature(tenant.id, feature.id, enabled)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
