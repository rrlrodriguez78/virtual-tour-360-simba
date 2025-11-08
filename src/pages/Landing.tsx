import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { MapPin, Layout, Eye, Zap } from 'lucide-react';
import heroImage from '@/assets/hero-bg.jpg';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

const Landing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/app/tours');
    }
  }, [user, loading, navigate]);
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PWAInstallPrompt />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)', opacity: 0.05 }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              {t('landing.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('landing.subtitle')}
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="text-lg px-8 bg-gradient-to-r from-primary via-accent to-secondary text-primary-foreground border-2 border-primary/50 hover:border-accent hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] hover:scale-105 transition-all duration-300 animate-pulse"
                >
                  {t('landing.getStarted')}
                </Button>
              </Link>
            <Link to="/app/tours-publicos">
              <Button 
                size="lg" 
                className="text-lg px-8 bg-gradient-to-r from-primary via-accent to-secondary text-primary-foreground border-2 border-primary/50 hover:border-accent hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] hover:scale-105 transition-all duration-300 animate-pulse"
              >
                View Tours Publicos
              </Button>
            </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">
            {t('landing.featuresTitle')}
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Layout className="w-8 h-8" />}
              title={t('landing.visualEditor')}
              description={t('landing.visualEditorDesc')}
            />
            <FeatureCard
              icon={<MapPin className="w-8 h-8" />}
              title={t('landing.hotspots360')}
              description={t('landing.hotspots360Desc')}
            />
            <FeatureCard
              icon={<Eye className="w-8 h-8" />}
              title={t('landing.publicView')}
              description={t('landing.publicViewDesc')}
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title={t('landing.autoSave')}
              description={t('landing.autoSaveDesc')}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl" 
               style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-elevated)' }}>
            <h2 className="text-4xl font-bold mb-4">
              {t('landing.ctaTitle')}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {t('landing.ctaSubtitle')}
            </p>
            <Link to="/signup">
              <Button size="lg" className="text-lg px-12">
                {t('landing.createAccount')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>{t('landing.footer')}</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-card via-card to-card/80 border-2 border-primary/30 hover:border-accent hover:shadow-[0_0_25px_rgba(var(--primary),0.4)] transition-all duration-300 hover:scale-105 hover:-translate-y-1">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center mb-4 text-primary-foreground shadow-lg animate-pulse">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

export default Landing;