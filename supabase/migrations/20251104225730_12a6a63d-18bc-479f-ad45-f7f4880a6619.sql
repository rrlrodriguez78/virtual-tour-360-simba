-- Crear tabla user_settings (faltaba en la migración original)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{"new_view":true,"new_user":true,"weekly_report":true}'::jsonb,
  theme TEXT DEFAULT 'system',
  color_scheme TEXT DEFAULT 'default',
  font_size TEXT DEFAULT 'medium',
  layout_mode TEXT DEFAULT 'extended',
  language TEXT DEFAULT 'en',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  time_format TEXT DEFAULT '12h',
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  profile_visibility TEXT DEFAULT 'private',
  data_sharing BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  image_quality TEXT DEFAULT 'high',
  data_usage TEXT DEFAULT 'auto',
  auto_downloads BOOLEAN DEFAULT true,
  local_storage_limit_mb INTEGER DEFAULT 500,
  cloud_sync BOOLEAN DEFAULT true,
  backup_frequency TEXT DEFAULT 'daily',
  sync_data_types JSONB DEFAULT '{"tours":true,"media":true,"settings":true}'::jsonb,
  cross_device_sync BOOLEAN DEFAULT true,
  default_volume INTEGER DEFAULT 80,
  video_quality TEXT DEFAULT 'high',
  autoplay BOOLEAN DEFAULT false,
  sound_effects BOOLEAN DEFAULT true,
  share_usage_data BOOLEAN DEFAULT false,
  auto_reports BOOLEAN DEFAULT true,
  metrics_to_track JSONB DEFAULT '{"views":true,"engagement":true,"performance":true}'::jsonb,
  report_frequency TEXT DEFAULT 'weekly',
  contact_preferences JSONB DEFAULT '{"email":true,"phone":false,"sms":false}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',
  pwa_auto_update BOOLEAN DEFAULT true,
  pwa_auto_update_delay INTEGER DEFAULT 0,
  pwa_browser_notifications BOOLEAN DEFAULT false,
  pwa_check_interval INTEGER DEFAULT 900000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Crear trigger para auto-crear settings cuando se crea un usuario
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

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_settings();

-- Crear settings para usuarios existentes
INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;