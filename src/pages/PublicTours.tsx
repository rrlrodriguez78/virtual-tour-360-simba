import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Eye, Globe, Search, Lock, Heart, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface Tour {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  is_published: boolean;
  password_protected?: boolean;
}

interface TourAnalytics {
  tour_id: string;
  likes_count: number;
  comments_count: number;
}

const PublicTours = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tours, setTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, TourAnalytics>>({});
  const [likedTours, setLikedTours] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [commentDialogOpen, setCommentDialogOpen] = useState<string | null>(null);
  const [commentForm, setCommentForm] = useState({
    name: '',
    email: '',
    comment: ''
  });

  useEffect(() => {
    fetchPublicTours();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTours(tours);
    } else {
      const filtered = tours.filter(tour =>
        tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tour.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTours(filtered);
    }
  }, [searchQuery, tours]);

  const fetchPublicTours = async () => {
    try {
      setLoading(true);
      // Public tours page: show ALL published tours (from any organization)
      // Frontend filter ensures only published tours are shown
      const { data, error } = await supabase
        .from('virtual_tours')
        .select('id, title, description, cover_image_url, created_at, is_published, password_protected')
        .eq('is_published', true) // Frontend filter: only published tours
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTours(data || []);
      setFilteredTours(data || []);

      // Fetch analytics for all tours
      if (data && data.length > 0) {
        const { data: analyticsData } = await supabase
          .from('tour_analytics')
          .select('tour_id, likes_count, comments_count')
          .in('tour_id', data.map(t => t.id));

        if (analyticsData) {
          const analyticsMap: Record<string, TourAnalytics> = {};
          analyticsData.forEach(a => {
            analyticsMap[a.tour_id] = a;
          });
          setAnalytics(analyticsMap);
        }
      }

      // Load liked tours from localStorage
      const storedLikes = localStorage.getItem('likedTours');
      if (storedLikes) {
        setLikedTours(new Set(JSON.parse(storedLikes)));
      }
    } catch (error) {
      console.error('Error fetching public tours:', error);
      toast.error(t('publicTours.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (tourId: string) => {
    const isLiked = likedTours.has(tourId);
    
    try {
      // Get current analytics
      const { data: currentAnalytics } = await supabase
        .from('tour_analytics')
        .select('likes_count')
        .eq('tour_id', tourId)
        .maybeSingle();

      const currentLikes = currentAnalytics?.likes_count || 0;
      const newLikes = isLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

      // Update analytics
      const { error } = await supabase
        .from('tour_analytics')
        .upsert({
          tour_id: tourId,
          likes_count: newLikes
        });

      if (error) throw error;

      // Update local state
      const newLikedTours = new Set(likedTours);
      if (isLiked) {
        newLikedTours.delete(tourId);
      } else {
        newLikedTours.add(tourId);
      }
      setLikedTours(newLikedTours);
      localStorage.setItem('likedTours', JSON.stringify(Array.from(newLikedTours)));

      // Update analytics state
      setAnalytics(prev => ({
        ...prev,
        [tourId]: {
          ...prev[tourId],
          tour_id: tourId,
          likes_count: newLikes,
          comments_count: prev[tourId]?.comments_count || 0
        }
      }));

      toast.success(isLiked ? t('publicTours.unliked') : t('publicTours.liked'));
    } catch (error) {
      console.error('Error updating like:', error);
      toast.error(t('publicTours.errorLike'));
    }
  };

  const handleComment = async (tourId: string) => {
    if (!commentForm.comment.trim()) {
      toast.error(t('publicTours.commentRequired'));
      return;
    }

    try {
      // Insert comment (most important operation)
      const { error: commentError } = await supabase
        .from('tour_comments')
        .insert({
          tour_id: tourId,
          commenter_name: commentForm.name.trim() || null,
          commenter_email: commentForm.email.trim() || null,
          comment_text: commentForm.comment.trim(),
          is_read: false
        });

      if (commentError) throw commentError;

      // Reset form and close dialog immediately
      setCommentForm({ name: '', email: '', comment: '' });
      setCommentDialogOpen(null);
      toast.success(t('publicTours.commentAdded'));

      // Refresh tours to get updated count from database (trigger handles count)
      await fetchPublicTours();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(t('publicTours.errorComment'));
    }
  };

  const viewTour = (tourId: string) => {
    navigate(`/viewer/${tourId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('publicTours.title')}</h1>
          <p className="text-muted-foreground">{t('publicTours.subtitle')}</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('publicTours.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tours Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-48 w-full rounded-md" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">{t('publicTours.noTours')}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTours.map((tour) => (
              <Card key={tour.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="p-0">
                  {tour.cover_image_url ? (
                    <img
                      src={tour.cover_image_url}
                      alt={tour.title}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Globe className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl line-clamp-1">{tour.title}</CardTitle>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {tour.password_protected && (
                        <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                          <Lock className="w-3 h-3" />
                        </Badge>
                      )}
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                      </Badge>
                    </div>
                  </div>
                  {tour.description && (
                    <CardDescription className="line-clamp-2">
                      {tour.description}
                    </CardDescription>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <div className="flex items-center justify-between w-full gap-2">
                    <Button
                      onClick={() => handleLike(tour.id)}
                      variant={likedTours.has(tour.id) ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                    >
                      <Heart className={`w-4 h-4 mr-1 ${likedTours.has(tour.id) ? 'fill-current' : ''}`} />
                      {analytics[tour.id]?.likes_count || 0}
                    </Button>

                    <Dialog open={commentDialogOpen === tour.id} onOpenChange={(open) => setCommentDialogOpen(open ? tour.id : null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          {analytics[tour.id]?.comments_count || 0}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('publicTours.addComment')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="name">{t('publicTours.name')} ({t('publicTours.optional')})</Label>
                            <Input
                              id="name"
                              value={commentForm.name}
                              onChange={(e) => setCommentForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder={t('publicTours.namePlaceholder')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">{t('publicTours.email')} ({t('publicTours.optional')})</Label>
                            <Input
                              id="email"
                              type="email"
                              value={commentForm.email}
                              onChange={(e) => setCommentForm(prev => ({ ...prev, email: e.target.value }))}
                              placeholder={t('publicTours.emailPlaceholder')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="comment">{t('publicTours.comment')} *</Label>
                            <Textarea
                              id="comment"
                              value={commentForm.comment}
                              onChange={(e) => setCommentForm(prev => ({ ...prev, comment: e.target.value }))}
                              placeholder={t('publicTours.commentPlaceholder')}
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setCommentDialogOpen(null)}>
                              {t('common.cancel')}
                            </Button>
                            <Button onClick={() => handleComment(tour.id)}>
                              {t('publicTours.submit')}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <Button
                    onClick={() => viewTour(tour.id)}
                    className="w-full"
                    variant="default"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('publicTours.viewTour')}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicTours;
