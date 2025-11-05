-- Create platform_ui_config table
CREATE TABLE public.platform_ui_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'both')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  component_path TEXT NOT NULL,
  layout_config JSONB DEFAULT '{}'::jsonb,
  feature_flags JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_name, platform)
);

-- Create platform_page_variants table
CREATE TABLE public.platform_page_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.platform_ui_config(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  code_override TEXT,
  css_overrides JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(config_id, variant_name)
);

-- Enable RLS
ALTER TABLE public.platform_ui_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_page_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_ui_config
CREATE POLICY "Super admins can manage platform UI config"
  ON public.platform_ui_config
  FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "All authenticated users can view active platform configs"
  ON public.platform_ui_config
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for platform_page_variants
CREATE POLICY "Super admins can manage platform page variants"
  ON public.platform_page_variants
  FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "All authenticated users can view platform page variants"
  ON public.platform_page_variants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_ui_config
      WHERE id = platform_page_variants.config_id
      AND is_active = true
    )
  );

-- Create indexes for performance
CREATE INDEX idx_platform_ui_config_page_platform ON public.platform_ui_config(page_name, platform);
CREATE INDEX idx_platform_ui_config_active ON public.platform_ui_config(is_active);
CREATE INDEX idx_platform_page_variants_config ON public.platform_page_variants(config_id);

-- Trigger to update updated_at
CREATE TRIGGER update_platform_ui_config_updated_at
  BEFORE UPDATE ON public.platform_ui_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_page_variants_updated_at
  BEFORE UPDATE ON public.platform_page_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();