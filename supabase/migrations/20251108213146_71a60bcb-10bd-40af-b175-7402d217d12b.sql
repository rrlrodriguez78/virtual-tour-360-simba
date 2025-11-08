-- Add new columns for granular push notification settings
ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS push_on_new_comment boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS push_on_new_like boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.notification_settings.push_on_new_comment IS 'Enable push notifications when someone comments on user tours';
COMMENT ON COLUMN public.notification_settings.push_on_new_like IS 'Enable push notifications when someone likes user tours';