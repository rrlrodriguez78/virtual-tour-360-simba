import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit, Trash2, Shield, Terminal, Lock, Unlock, FileText, Bell, ListChecks, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationsList } from '@/components/settings/NotificationsList';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { AnalyticsDashboard } from '@/components/settings/AnalyticsDashboard';
import { ImplementationChecklist } from '@/components/settings/ImplementationChecklist';
import { PWAUpdateSettings } from '@/components/settings/PWAUpdateSettings';

interface GoldenRule {
  id: string;
  rule_number: number;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface Command {
  id: string;
  command_number: number;
  title: string;
  description: string;
  command_text: string;
  is_active: boolean;
  created_at: string;
}

interface Page {
  id: string;
  name: string;
  route: string;
  description: string | null;
  is_locked: boolean;
  created_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useIsSuperAdmin();
  const { t } = useTranslation();
  const [rules, setRules] = useState<GoldenRule[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GoldenRule | null>(null);
  const [editingCommand, setEditingCommand] = useState<Command | null>(null);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [formData, setFormData] = useState({
    rule_number: 0,
    title: '',
    description: '',
  });
  const [commandFormData, setCommandFormData] = useState({
    command_number: 0,
    title: '',
    description: '',
    command_text: '',
  });
  const [pageFormData, setPageFormData] = useState({
    name: '',
    route: '',
    description: '',
  });

  // Log access attempt
  useEffect(() => {
    const logAccess = async () => {
      if (authLoading || superAdminLoading || !user) return;

      const accessType = isSuperAdmin ? 'allowed' : 'denied';
      
      try {
        // Log access to database
        await supabase
          .from('settings_access_logs')
          .insert({
            user_id: user.id,
            access_type: accessType,
            ip_address: null,
            user_agent: navigator.userAgent
          });

        console.log('Settings access logged:', { accessType, userId: user.id });
      } catch (error) {
        console.error('Error in access logging:', error);
      }
    };

    logAccess();
  }, [user, authLoading, superAdminLoading, isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    // Redirect if not super admin
    if (!authLoading && !superAdminLoading && user && !isSuperAdmin) {
      toast.error('Access denied. This page is only accessible to super admins.');
      navigate('/app/tours');
    }
  }, [user, authLoading, isSuperAdmin, superAdminLoading, navigate]);

  useEffect(() => {
    if (user && isSuperAdmin) {
      loadRules();
      loadCommands();
      loadPages();
    }
  }, [user, isSuperAdmin]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('golden_rules')
        .select('*')
        .eq('is_active', true)
        .order('rule_number', { ascending: true });

      if (error) throw error;
      if (data) setRules(data);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error(t('settings.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const loadCommands = async () => {
    try {
      const { data, error } = await supabase
        .from('commands')
        .select('*')
        .eq('is_active', true)
        .order('command_number', { ascending: true });

      if (error) throw error;
      if (data) setCommands(data);
    } catch (error) {
      console.error('Error loading commands:', error);
      toast.error('Error loading commands');
    }
  };

  const loadPages = async () => {
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) setPages(data);
    } catch (error) {
      console.error('Error loading pages:', error);
      toast.error('Error loading pages');
    }
  };

  const handleOpenModal = (rule?: GoldenRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        rule_number: rule.rule_number,
        title: rule.title,
        description: rule.description,
      });
    } else {
      setEditingRule(null);
      const nextRuleNumber = rules.length > 0 ? Math.max(...rules.map(r => r.rule_number)) + 1 : 3;
      setFormData({
        rule_number: nextRuleNumber,
        title: '',
        description: '',
      });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRule(null);
    setFormData({ rule_number: 0, title: '', description: '' });
  };

  const handleSaveRule = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error(t('settings.fillAllFields'));
      return;
    }

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('golden_rules')
          .update({
            rule_number: formData.rule_number,
            title: formData.title,
            description: formData.description,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success(t('settings.ruleUpdated'));
      } else {
        const { error } = await supabase
          .from('golden_rules')
          .insert({
            rule_number: formData.rule_number,
            title: formData.title,
            description: formData.description,
          });

        if (error) throw error;
        toast.success(t('settings.ruleAdded'));
      }

      handleCloseModal();
      loadRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error(t('settings.errorSaving'));
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('golden_rules')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success(t('settings.ruleDeleted'));
      loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error(t('settings.errorDeleting'));
    }
  };

  const handleOpenCommandModal = (command?: Command) => {
    if (command) {
      setEditingCommand(command);
      setCommandFormData({
        command_number: command.command_number,
        title: command.title,
        description: command.description,
        command_text: command.command_text,
      });
    } else {
      setEditingCommand(null);
      const nextCommandNumber = commands.length > 0 ? Math.max(...commands.map(c => c.command_number)) + 1 : 1;
      setCommandFormData({
        command_number: nextCommandNumber,
        title: '',
        description: '',
        command_text: '',
      });
    }
    setCommandModalOpen(true);
  };

  const handleCloseCommandModal = () => {
    setCommandModalOpen(false);
    setEditingCommand(null);
    setCommandFormData({ command_number: 0, title: '', description: '', command_text: '' });
  };

  const handleSaveCommand = async () => {
    if (!commandFormData.title.trim() || !commandFormData.description.trim() || !commandFormData.command_text.trim()) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      if (editingCommand) {
        const { error } = await supabase
          .from('commands')
          .update({
            command_number: commandFormData.command_number,
            title: commandFormData.title,
            description: commandFormData.description,
            command_text: commandFormData.command_text,
          })
          .eq('id', editingCommand.id);

        if (error) throw error;
        toast.success('Command updated successfully');
      } else {
        const { error } = await supabase
          .from('commands')
          .insert({
            command_number: commandFormData.command_number,
            title: commandFormData.title,
            description: commandFormData.description,
            command_text: commandFormData.command_text,
          });

        if (error) throw error;
        toast.success('Command added successfully');
      }

      handleCloseCommandModal();
      loadCommands();
    } catch (error) {
      console.error('Error saving command:', error);
      toast.error('Error saving command');
    }
  };

  const handleDeleteCommand = async (id: string) => {
    try {
      const { error } = await supabase
        .from('commands')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Command deleted successfully');
      loadCommands();
    } catch (error) {
      console.error('Error deleting command:', error);
      toast.error('Error deleting command');
    }
  };

  const handleOpenPageModal = (page?: Page) => {
    if (page) {
      setEditingPage(page);
      setPageFormData({
        name: page.name,
        route: page.route,
        description: page.description || '',
      });
    } else {
      setEditingPage(null);
      setPageFormData({
        name: '',
        route: '',
        description: '',
      });
    }
    setPageModalOpen(true);
  };

  const handleClosePageModal = () => {
    setPageModalOpen(false);
    setEditingPage(null);
    setPageFormData({ name: '', route: '', description: '' });
  };

  const handleSavePage = async () => {
    if (!pageFormData.name.trim() || !pageFormData.route.trim()) {
      toast.error('Please fill name and route fields');
      return;
    }

    try {
      if (editingPage) {
        const { error } = await supabase
          .from('pages')
          .update({
            name: pageFormData.name,
            route: pageFormData.route,
            description: pageFormData.description,
          })
          .eq('id', editingPage.id);

        if (error) throw error;
        toast.success('Page updated successfully');
      } else {
        const { error } = await supabase
          .from('pages')
          .insert({
            name: pageFormData.name,
            route: pageFormData.route,
            description: pageFormData.description,
            is_locked: false,
          });

        if (error) throw error;
        toast.success('Page added successfully');
      }

      handleClosePageModal();
      loadPages();
    } catch (error) {
      console.error('Error saving page:', error);
      toast.error('Error saving page');
    }
  };

  const handleTogglePageLock = async (id: string, currentLockState: boolean) => {
    try {
      const { error } = await supabase
        .from('pages')
        .update({ is_locked: !currentLockState })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Page ${!currentLockState ? 'locked' : 'unlocked'} successfully`);
      loadPages();
    } catch (error) {
      console.error('Error toggling page lock:', error);
      toast.error('Error toggling page lock');
    }
  };

  const handleDeletePage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Page deleted successfully');
      loadPages();
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error('Error deleting page');
    }
  };

  if (authLoading || superAdminLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Show access denied if not super admin
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to access this page. Only super administrators can access settings.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => navigate('/app/tours')}
            className="mt-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/app/inicio')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('settings.backToDashboard')}
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">{t('settings.title')}</h1>
            <p className="text-muted-foreground">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notificaciones
            </TabsTrigger>
            <TabsTrigger value="pwa">
              <RefreshCw className="w-4 h-4 mr-2" />
              PWA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Sistema de Notificaciones y Analytics</CardTitle>
                  <CardDescription>
                    Monitorea la actividad de tus tours, visualiza estadísticas y configura notificaciones
                  </CardDescription>
                </CardHeader>
              </Card>

              <Tabs defaultValue="notifications" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="notifications">
                    <Bell className="w-4 h-4 mr-2" />
                    Notificaciones
                  </TabsTrigger>
                  <TabsTrigger value="analytics">
                    <Shield className="w-4 h-4 mr-2" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="config">
                    <Terminal className="w-4 h-4 mr-2" />
                    Configuración
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notifications">
                  <NotificationsList />
                </TabsContent>

                <TabsContent value="analytics">
                  <AnalyticsDashboard />
                </TabsContent>

                <TabsContent value="config">
                  <NotificationSettings />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="pwa">
            <PWAUpdateSettings />
          </TabsContent>
        </Tabs>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRule ? t('settings.editRule') : t('settings.addNewRule')}
              </DialogTitle>
              <DialogDescription>
                {editingRule ? t('settings.updateRuleDescription') : t('settings.createRuleDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="rule_number">{t('settings.ruleNumber')}</Label>
                <Input
                  id="rule_number"
                  type="number"
                  value={formData.rule_number}
                  onChange={(e) => setFormData({ ...formData, rule_number: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="title">{t('settings.title_field')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('settings.enterTitle')}
                />
              </div>

              <div>
                <Label htmlFor="description">{t('settings.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('settings.enterDescription')}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseModal}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveRule}>
                {editingRule ? t('settings.updateRule') : t('settings.addRule')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={commandModalOpen} onOpenChange={setCommandModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCommand ? 'Edit Command' : 'Add New Command'}
              </DialogTitle>
              <DialogDescription>
                {editingCommand ? 'Update the command details' : 'Create a new numbered command for quick reference'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="command_number">Command Number</Label>
                <Input
                  id="command_number"
                  type="number"
                  value={commandFormData.command_number}
                  onChange={(e) => setCommandFormData({ ...commandFormData, command_number: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="command_title">Title</Label>
                <Input
                  id="command_title"
                  value={commandFormData.title}
                  onChange={(e) => setCommandFormData({ ...commandFormData, title: e.target.value })}
                  placeholder="e.g., Fullscreen Portal Fix"
                />
              </div>

              <div>
                <Label htmlFor="command_description">Description</Label>
                <Textarea
                  id="command_description"
                  value={commandFormData.description}
                  onChange={(e) => setCommandFormData({ ...commandFormData, description: e.target.value })}
                  placeholder="Brief description of what this command does"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="command_text">Command Instructions</Label>
                <Textarea
                  id="command_text"
                  value={commandFormData.command_text}
                  onChange={(e) => setCommandFormData({ ...commandFormData, command_text: e.target.value })}
                  placeholder="Detailed instructions for executing this command"
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseCommandModal}>
                Cancel
              </Button>
              <Button onClick={handleSaveCommand}>
                {editingCommand ? 'Update Command' : 'Add Command'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pageModalOpen} onOpenChange={setPageModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPage ? 'Edit Page' : 'Add New Page'}
              </DialogTitle>
              <DialogDescription>
                {editingPage ? 'Update the page details' : 'Create a new page entry'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="page_name">Page Name</Label>
                <Input
                  id="page_name"
                  value={pageFormData.name}
                  onChange={(e) => setPageFormData({ ...pageFormData, name: e.target.value })}
                  placeholder="e.g., Dashboard"
                />
              </div>

              <div>
                <Label htmlFor="page_route">Route</Label>
                <Input
                  id="page_route"
                  value={pageFormData.route}
                  onChange={(e) => setPageFormData({ ...pageFormData, route: e.target.value })}
                  placeholder="e.g., /app/dashboard"
                />
              </div>

              <div>
                <Label htmlFor="page_description">Description</Label>
                <Textarea
                  id="page_description"
                  value={pageFormData.description}
                  onChange={(e) => setPageFormData({ ...pageFormData, description: e.target.value })}
                  placeholder="Brief description of the page"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClosePageModal}>
                Cancel
              </Button>
              <Button onClick={handleSavePage}>
                {editingPage ? 'Update Page' : 'Add Page'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Settings;
