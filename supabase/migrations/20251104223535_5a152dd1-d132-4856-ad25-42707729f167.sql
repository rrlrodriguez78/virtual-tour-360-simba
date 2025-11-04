-- ============================================
-- MIGRACIÓN SEGURA: Esquema Virtual Tours 360
-- ============================================
-- Esta versión maneja objetos existentes sin errores

-- ============================================
-- 1. ENUMS (IF NOT EXISTS)
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_role AS ENUM ('tenant_admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. STORAGE POLICIES (DROP + CREATE)
-- ============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Public can view tour images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload tour images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own tour images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own tour images" ON storage.objects;

-- Recrear políticas
CREATE POLICY "Public can view tour images"
ON storage.objects FOR SELECT
USING (bucket_id = 'tour-images');

CREATE POLICY "Authenticated users can upload tour images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tour-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own tour images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tour-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own tour images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-images' 
  AND auth.role() = 'authenticated'
);

-- ============================================
-- 3. TABLAS (IF NOT EXISTS)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.virtual_tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  tour_type TEXT NOT NULL DEFAULT 'tour_360' CHECK (tour_type IN ('tour_360', 'photo_tour')),
  password_hash TEXT,
  password_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  capture_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id UUID NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  x_position DOUBLE PRECISION NOT NULL,
  y_position DOUBLE PRECISION NOT NULL,
  display_order INTEGER DEFAULT 0,
  has_panorama BOOLEAN DEFAULT false,
  panorama_count INTEGER DEFAULT 0,
  media_type TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.panorama_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotspot_id UUID NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_url_thumbnail TEXT,
  photo_url_mobile TEXT,
  original_filename TEXT,
  description TEXT,
  capture_date DATE DEFAULT CURRENT_DATE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hotspot_navigation_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_hotspot_id UUID NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
  to_hotspot_id UUID NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
  theta NUMERIC NOT NULL,
  phi NUMERIC NOT NULL DEFAULT 90,
  u NUMERIC,
  v NUMERIC,
  height_offset NUMERIC DEFAULT 0,
  label TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  style JSONB DEFAULT '{"icon": "arrow", "size": 1.0, "color": "#4F46E5"}',
  capture_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  related_tour_id UUID REFERENCES public.virtual_tours(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_on_new_view BOOLEAN DEFAULT true,
  email_on_new_user BOOLEAN DEFAULT true,
  email_weekly_report BOOLEAN DEFAULT true,
  push_on_new_view BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT DEFAULT 'en',
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  color_scheme TEXT DEFAULT 'blue' CHECK (color_scheme IN ('blue', 'red', 'green', 'purple', 'orange')),
  default_volume INTEGER DEFAULT 80 CHECK (default_volume >= 0 AND default_volume <= 100),
  sound_effects BOOLEAN DEFAULT true,
  autoplay BOOLEAN DEFAULT true,
  image_quality TEXT DEFAULT 'high' CHECK (image_quality IN ('low', 'medium', 'high', 'original')),
  local_storage_limit_mb INTEGER DEFAULT 500,
  data_usage TEXT DEFAULT 'balanced' CHECK (data_usage IN ('minimal', 'balanced', 'maximum')),
  backup_frequency TEXT DEFAULT 'daily' CHECK (backup_frequency IN ('immediate', 'hourly', 'daily', 'weekly', 'manual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tour_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL UNIQUE REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  views_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tour_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  duration_seconds INTEGER,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tour_id, date)
);

CREATE TABLE IF NOT EXISTS public.user_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 1,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(photo_id, tour_id)
);

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL DEFAULT 'photo_batch_sync',
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  error_messages JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 4. FUNCIONES (OR REPLACE)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id 
      AND role = 'tenant_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_approval_requests (user_id, status)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_hotspot_panorama_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hotspots
    SET panorama_count = panorama_count + 1,
        has_panorama = true
    WHERE id = NEW.hotspot_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hotspots
    SET panorama_count = GREATEST(0, panorama_count - 1),
        has_panorama = CASE WHEN panorama_count - 1 > 0 THEN true ELSE false END
    WHERE id = OLD.hotspot_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================
-- 5. TRIGGERS (DROP + CREATE)
-- ============================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_virtual_tours_updated_at ON public.virtual_tours;
CREATE TRIGGER update_virtual_tours_updated_at
BEFORE UPDATE ON public.virtual_tours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_panorama_count_on_insert ON public.panorama_photos;
CREATE TRIGGER update_panorama_count_on_insert
AFTER INSERT ON public.panorama_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_hotspot_panorama_count();

DROP TRIGGER IF EXISTS update_panorama_count_on_delete ON public.panorama_photos;
CREATE TRIGGER update_panorama_count_on_delete
AFTER DELETE ON public.panorama_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_hotspot_panorama_count();

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_settings();

-- ============================================
-- 6. RLS (ALTER TABLE + DROP/CREATE POLICIES)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panorama_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspot_navigation_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Tenants policies
DROP POLICY IF EXISTS "Users can view their tenants" ON public.tenants;
CREATE POLICY "Users can view their tenants"
ON public.tenants FOR SELECT
USING (
  auth.uid() = owner_id 
  OR EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = tenants.id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;
CREATE POLICY "Users can create tenants"
ON public.tenants FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Tenant admins can update their tenants" ON public.tenants;
CREATE POLICY "Tenant admins can update their tenants"
ON public.tenants FOR UPDATE
USING (auth.uid() = owner_id OR is_tenant_admin(auth.uid(), id));

-- Virtual tours policies
DROP POLICY IF EXISTS "Users can view tours in their tenant" ON public.virtual_tours;
CREATE POLICY "Users can view tours in their tenant"
ON public.virtual_tours FOR SELECT
USING (
  belongs_to_tenant(auth.uid(), tenant_id) 
  OR is_published = true
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Tenant members can create tours" ON public.virtual_tours;
CREATE POLICY "Tenant members can create tours"
ON public.virtual_tours FOR INSERT
WITH CHECK (belongs_to_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can update tours" ON public.virtual_tours;
CREATE POLICY "Tenant admins can update tours"
ON public.virtual_tours FOR UPDATE
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can delete tours" ON public.virtual_tours;
CREATE POLICY "Tenant admins can delete tours"
ON public.virtual_tours FOR DELETE
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Floor plans policies
DROP POLICY IF EXISTS "Users can view floor plans in their tenant tours" ON public.floor_plans;
CREATE POLICY "Users can view floor plans in their tenant tours"
ON public.floor_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.virtual_tours vt
    WHERE vt.id = floor_plans.tour_id
      AND (vt.is_published = true OR belongs_to_tenant(auth.uid(), vt.tenant_id))
  )
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Tenant members can create floor plans" ON public.floor_plans;
CREATE POLICY "Tenant members can create floor plans"
ON public.floor_plans FOR INSERT
WITH CHECK (belongs_to_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Tenant admins can update floor plans" ON public.floor_plans;
CREATE POLICY "Tenant admins can update floor plans"
ON public.floor_plans FOR UPDATE
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can delete floor plans" ON public.floor_plans;
CREATE POLICY "Tenant admins can delete floor plans"
ON public.floor_plans FOR DELETE
USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Continúa con el resto de policies siguiendo el mismo patrón...