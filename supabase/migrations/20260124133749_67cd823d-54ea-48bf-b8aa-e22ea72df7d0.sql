-- Create saas schema
CREATE SCHEMA IF NOT EXISTS saas;

-- 2.1 saas.users - Pivot minimal admin
CREATE TABLE IF NOT EXISTS saas.users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  sector TEXT,
  onesignal_external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 saas.access_state
CREATE TABLE IF NOT EXISTS saas.access_state (
  user_id UUID PRIMARY KEY REFERENCES saas.users(user_id) ON DELETE CASCADE,
  trial_started_at TIMESTAMPTZ DEFAULT now(),
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '15 days'),
  app_access TEXT CHECK (app_access IN ('trial', 'active', 'paywall', 'blocked')) DEFAULT 'trial',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 saas.subscriptions
CREATE TABLE IF NOT EXISTS saas.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES saas.users(user_id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'unpaid', 'blocked', 'incomplete')) DEFAULT 'trial',
  current_period_end TIMESTAMPTZ,
  past_due_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 saas.admin_users
CREATE TABLE IF NOT EXISTS saas.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 saas.notification_log
CREATE TABLE IF NOT EXISTS saas.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES saas.admin_users(user_id),
  audience TEXT,
  title TEXT,
  message TEXT,
  onesignal_response JSONB,
  status TEXT CHECK (status IN ('queued', 'sent', 'failed')) DEFAULT 'queued'
);

-- 2.6 saas.support_tickets
CREATE TABLE IF NOT EXISTS saas.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES saas.users(user_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 saas.support_replies
CREATE TABLE IF NOT EXISTS saas.support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES saas.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  is_admin BOOLEAN DEFAULT false,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.8 saas.feature_requests
CREATE TABLE IF NOT EXISTS saas.feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES saas.users(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'under_review', 'planned', 'in_progress', 'completed', 'rejected')) DEFAULT 'pending',
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all saas tables
ALTER TABLE saas.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.access_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.support_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.feature_requests ENABLE ROW LEVEL SECURITY;

-- Function to check if user is saas admin
CREATE OR REPLACE FUNCTION saas.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = saas
AS $$
  SELECT EXISTS (
    SELECT 1 FROM saas.admin_users WHERE user_id = _user_id
  )
$$;

-- RLS Policies for saas.users
CREATE POLICY "Users can view own saas profile" ON saas.users
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can update own saas profile" ON saas.users
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all saas users" ON saas.users
  FOR SELECT USING (saas.is_admin(auth.uid()));

-- RLS Policies for saas.access_state
CREATE POLICY "Users can view own access state" ON saas.access_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all access states" ON saas.access_state
  FOR SELECT USING (saas.is_admin(auth.uid()));

CREATE POLICY "Admins can update access states" ON saas.access_state
  FOR UPDATE USING (saas.is_admin(auth.uid()));

-- RLS Policies for saas.subscriptions
CREATE POLICY "Users can view own subscription" ON saas.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON saas.subscriptions
  FOR SELECT USING (saas.is_admin(auth.uid()));

CREATE POLICY "Admins can update subscriptions" ON saas.subscriptions
  FOR UPDATE USING (saas.is_admin(auth.uid()));

-- RLS Policies for saas.admin_users
CREATE POLICY "Admins can view admin list" ON saas.admin_users
  FOR SELECT USING (saas.is_admin(auth.uid()));

-- RLS Policies for saas.notification_log
CREATE POLICY "Admins can view notification log" ON saas.notification_log
  FOR SELECT USING (saas.is_admin(auth.uid()));

CREATE POLICY "Admins can insert notification log" ON saas.notification_log
  FOR INSERT WITH CHECK (saas.is_admin(auth.uid()));

-- RLS Policies for saas.support_tickets
CREATE POLICY "Users can view own tickets" ON saas.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets" ON saas.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets" ON saas.support_tickets
  FOR SELECT USING (saas.is_admin(auth.uid()));

CREATE POLICY "Admins can update tickets" ON saas.support_tickets
  FOR UPDATE USING (saas.is_admin(auth.uid()));

-- RLS Policies for saas.support_replies
CREATE POLICY "Users can view replies on own tickets" ON saas.support_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saas.support_tickets t 
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add replies to own tickets" ON saas.support_replies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM saas.support_tickets t 
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    ) AND is_admin = false
  );

CREATE POLICY "Admins can view all replies" ON saas.support_replies
  FOR SELECT USING (saas.is_admin(auth.uid()));

CREATE POLICY "Admins can add replies" ON saas.support_replies
  FOR INSERT WITH CHECK (saas.is_admin(auth.uid()));

-- RLS Policies for saas.feature_requests
CREATE POLICY "Users can view own feature requests" ON saas.feature_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create feature requests" ON saas.feature_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all feature requests" ON saas.feature_requests
  FOR SELECT USING (saas.is_admin(auth.uid()));

CREATE POLICY "Admins can update feature requests" ON saas.feature_requests
  FOR UPDATE USING (saas.is_admin(auth.uid()));

-- Trigger to auto-create saas.users entry on signup
CREATE OR REPLACE FUNCTION saas.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = saas
AS $$
BEGIN
  INSERT INTO saas.users (user_id, email, first_name, last_name, onesignal_external_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.id::text
  );
  
  INSERT INTO saas.access_state (user_id)
  VALUES (NEW.id);
  
  INSERT INTO saas.subscriptions (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created_saas ON auth.users;
CREATE TRIGGER on_auth_user_created_saas
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION saas.handle_new_user();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION saas.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = saas
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_access_state_updated_at
  BEFORE UPDATE ON saas.access_state
  FOR EACH ROW EXECUTE FUNCTION saas.update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON saas.subscriptions
  FOR EACH ROW EXECUTE FUNCTION saas.update_updated_at();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON saas.support_tickets
  FOR EACH ROW EXECUTE FUNCTION saas.update_updated_at();

CREATE TRIGGER update_feature_requests_updated_at
  BEFORE UPDATE ON saas.feature_requests
  FOR EACH ROW EXECUTE FUNCTION saas.update_updated_at();