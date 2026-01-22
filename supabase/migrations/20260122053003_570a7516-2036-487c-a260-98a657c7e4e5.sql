-- Create settings_notifications table for storing notification preferences
CREATE TABLE public.settings_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  confirmateur_phone VARCHAR(20),
  confirmateur_name VARCHAR(100),
  whatsapp_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.settings_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can CRUD own notification settings"
ON public.settings_notifications
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_settings_notifications_updated_at
BEFORE UPDATE ON public.settings_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();