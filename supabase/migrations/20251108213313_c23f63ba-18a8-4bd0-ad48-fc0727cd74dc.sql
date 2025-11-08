-- Create table to store FCM tokens for push notifications
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_type text NOT NULL DEFAULT 'android',
  device_info jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own FCM tokens"
  ON public.fcm_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own FCM tokens"
  ON public.fcm_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own FCM tokens"
  ON public.fcm_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own FCM tokens"
  ON public.fcm_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- System can read all tokens for sending notifications
CREATE POLICY "Service role can read all tokens"
  ON public.fcm_tokens
  FOR SELECT
  TO service_role
  USING (true);

-- Create index for faster lookups
CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_active ON public.fcm_tokens(is_active) WHERE is_active = true;

-- Add trigger to update updated_at
CREATE TRIGGER update_fcm_tokens_updated_at
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.fcm_tokens IS 'Stores Firebase Cloud Messaging tokens for push notifications to mobile devices';