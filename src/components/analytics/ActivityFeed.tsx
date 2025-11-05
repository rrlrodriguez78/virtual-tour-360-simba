import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { Clock, Plus, Eye, MessageSquare, Heart, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { motion } from 'framer-motion';

interface Activity {
  id: string;
  type: 'tour_created' | 'new_view' | 'new_comment' | 'new_like' | 'email_sent';
  title: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
}

export const ActivityFeed = () => {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();

    // Subscribe to real-time updates
    if (!currentTenant) return;

    const channels = [
      // Tour views
      supabase
        .channel('tour_views_activity')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tour_views'
          },
          () => loadActivities()
        )
        .subscribe(),

      // Tour comments
      supabase
        .channel('tour_comments_activity')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tour_comments'
          },
          () => loadActivities()
        )
        .subscribe(),

      // Email logs
      supabase
        .channel('email_logs_activity')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'email_logs'
          },
          () => loadActivities()
        )
        .subscribe(),

      // Virtual tours
      supabase
        .channel('virtual_tours_activity')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'virtual_tours'
          },
          () => loadActivities()
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [currentTenant]);

  const loadActivities = async () => {
    if (!currentTenant) {
      setLoading(false);
      return;
    }

    try {
      const allActivities: Activity[] = [];

      // Get tours
      const { data: tours } = await (supabase
        .from('virtual_tours')
        .select('id, title, created_at')
        .eq('tenant_id', currentTenant.tenant_id) as any);

      if (!tours || tours.length === 0) {
        setLoading(false);
        return;
      }

      // 1. Tour creation activities
      const tourActivities = tours.slice(0, 5).map(tour => ({
        id: `tour-${tour.id}`,
        type: 'tour_created' as const,
        title: `${t('inicio.createdTour')}: ${tour.title}`,
        timestamp: tour.created_at,
        icon: <Plus className="w-4 h-4" />,
        color: 'text-success',
      }));
      allActivities.push(...tourActivities);

      // 2. View activities from tour_views
      const { data: recentViews } = await supabase
        .from('tour_views')
        .select('id, tour_id, viewed_at, virtual_tours(title)')
        .in('tour_id', tours.map(t => t.id))
        .order('viewed_at', { ascending: false })
        .limit(10);

      if (recentViews) {
        const viewActivities = recentViews.map(view => ({
          id: `view-${view.id}`,
          type: 'new_view' as const,
          title: `${t('inicio.newViewOn')}: ${(view.virtual_tours as any)?.title || 'Tour'}`,
          timestamp: view.viewed_at,
          icon: <Eye className="w-4 h-4" />,
          color: 'text-info',
        }));
        allActivities.push(...viewActivities);
      }

      // 3. Comment activities
      const { data: recentComments } = await supabase
        .from('tour_comments')
        .select('id, comment_text, created_at')
        .in('tour_id', tours.map(t => t.id))
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentComments) {
        const commentActivities = recentComments.map(comment => ({
          id: `comment-${comment.id}`,
          type: 'new_comment' as const,
          title: `${t('inicio.newComment')}: ${comment.comment_text.substring(0, 40)}...`,
          timestamp: comment.created_at,
          icon: <MessageSquare className="w-4 h-4" />,
          color: 'text-secondary',
        }));
        allActivities.push(...commentActivities);
      }

      // 4. Email activities
      const { data: tenantData } = await supabase
        .from('tenants' as any)
        .select('owner_id')
        .eq('id', currentTenant.tenant_id)
        .maybeSingle();

      const { data: recentEmails } = await supabase
        .from('email_logs')
        .select('id, notification_type, sent_at, status')
        .eq('user_id', (tenantData as any)?.owner_id)
        .order('sent_at', { ascending: false })
        .limit(10);

      if (recentEmails) {
        const emailActivities = recentEmails.map(email => ({
          id: `email-${email.id}`,
          type: 'email_sent' as const,
          title: `${t('inicio.emailSent')}: ${email.notification_type.replace('_', ' ')}`,
          timestamp: email.sent_at,
          icon: <Mail className="w-4 h-4" />,
          color: email.status === 'sent' ? 'text-success' : 'text-destructive',
        }));
        allActivities.push(...emailActivities);
      }

      // Sort all activities by timestamp
      allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Take top 20 activities
      setActivities(allActivities.slice(0, 20));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Card className="p-6 border-2 border-muted/20 bg-gradient-to-br from-background to-muted/5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold font-futuristic flex items-center gap-2">
          <Clock className="w-5 h-5 text-foreground" />
          {t('inicio.activityFeed')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 font-body-future">
          Recent activity across your tours
        </p>
      </div>

      {/* Activity List */}
      <ScrollArea className="h-96">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/50 transition-colors"
              >
                {/* Icon */}
                <div className={`p-2 rounded-lg bg-background ${activity.color}`}>
                  {activity.icon}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <p className="font-medium font-body-future">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getTimeAgo(activity.timestamp)}
                  </p>
                </div>

                {/* Badge */}
                <Badge variant="outline" className="font-body-future">
                  {activity.type.replace('_', ' ')}
                </Badge>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Clock className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
