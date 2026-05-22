-- ============================================================================
-- Amazon Link Generator Dashboard — Full Database Schema
-- Paste this ENTIRE script into the Supabase SQL Editor and click "Run"
-- ============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE public.link_type AS ENUM (
  'CLEAN', 'KEYWORD', 'AFFILIATE', 'AFFILIATE_KEYWORD', 
  'UTM', 'SHORTENED', 'QR', 'SEARCH_PAGE', 'VARIANT'
);

CREATE TYPE public.job_status AS ENUM (
  'pending', 'processing', 'completed', 'failed'
);


-- ============================================================================
-- TABLE 1: profiles (extends auth.users)
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  affiliate_tag TEXT DEFAULT NULL,
  default_marketplace TEXT DEFAULT 'amazon.in',
  theme_preference TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- TABLE 2: products
-- ============================================================================

CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asin VARCHAR(10) NOT NULL CHECK (asin ~ '^[A-Z0-9]{10}$'),
  title TEXT,
  original_url TEXT NOT NULL,
  marketplace VARCHAR(50) DEFAULT 'amazon.in',
  image_url TEXT,
  keywords TEXT[] DEFAULT '{}',
  total_links INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_products_asin ON public.products(asin);
CREATE INDEX idx_products_created_at ON public.products(created_at DESC);


-- ============================================================================
-- TABLE 3: generated_links
-- ============================================================================

CREATE TABLE public.generated_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  link_type public.link_type NOT NULL,
  url TEXT NOT NULL,
  short_code VARCHAR(10) UNIQUE,
  short_url TEXT,
  keywords TEXT[],
  affiliate_tag TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  variant_params TEXT,
  click_count INTEGER DEFAULT 0,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_links_user_id ON public.generated_links(user_id);
CREATE INDEX idx_generated_links_product_id ON public.generated_links(product_id);
CREATE INDEX idx_generated_links_type ON public.generated_links(link_type);
CREATE INDEX idx_generated_links_short_code ON public.generated_links(short_code);
CREATE INDEX idx_generated_links_created_at ON public.generated_links(created_at DESC);


-- ============================================================================
-- TABLE 4: keywords
-- ============================================================================

CREATE TABLE public.keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_keywords_user_id ON public.keywords(user_id);
CREATE INDEX idx_keywords_usage ON public.keywords(usage_count DESC);


-- ============================================================================
-- TABLE 5: link_clicks (analytics)
-- ============================================================================

CREATE TABLE public.link_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID REFERENCES public.generated_links(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX idx_link_clicks_user_id ON public.link_clicks(user_id);
CREATE INDEX idx_link_clicks_clicked_at ON public.link_clicks(clicked_at DESC);


-- ============================================================================
-- TABLE 6: csv_jobs
-- ============================================================================

CREATE TABLE public.csv_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.job_status DEFAULT 'pending',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_csv_jobs_user_id ON public.csv_jobs(user_id);
CREATE INDEX idx_csv_jobs_status ON public.csv_jobs(status);


-- ============================================================================
-- TABLE 7: templates
-- ============================================================================

CREATE TABLE public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{
    "linkTypes": ["CLEAN", "KEYWORD"],
    "keywords": [],
    "utmParams": {}
  }',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Products
CREATE POLICY "Users can view own products" 
  ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own products" 
  ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" 
  ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" 
  ON public.products FOR DELETE USING (auth.uid() = user_id);

-- Generated Links
CREATE POLICY "Users can view own links" 
  ON public.generated_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own links" 
  ON public.generated_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own links" 
  ON public.generated_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own links" 
  ON public.generated_links FOR DELETE USING (auth.uid() = user_id);

-- Keywords
CREATE POLICY "Users can view own keywords" 
  ON public.keywords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own keywords" 
  ON public.keywords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own keywords" 
  ON public.keywords FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own keywords" 
  ON public.keywords FOR DELETE USING (auth.uid() = user_id);

-- Link Clicks
CREATE POLICY "Users can view own clicks" 
  ON public.link_clicks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clicks" 
  ON public.link_clicks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CSV Jobs
CREATE POLICY "Users can view own csv jobs" 
  ON public.csv_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own csv jobs" 
  ON public.csv_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own csv jobs" 
  ON public.csv_jobs FOR UPDATE USING (auth.uid() = user_id);

-- Templates
CREATE POLICY "Users can view own templates" 
  ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own templates" 
  ON public.templates FOR ALL USING (auth.uid() = user_id);


-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- 1. Generate a unique short code for link redirection
CREATE OR REPLACE FUNCTION public.generate_unique_short_code(length INTEGER DEFAULT 7)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
  exists_check BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..length LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.generated_links WHERE short_code = result) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Fetch dashboard statistics in a single RPC call
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  IF auth.uid() <> user_uuid THEN
    RAISE EXCEPTION 'Unauthorized: user_uuid does not match authenticated user';
  END IF;

  SELECT jsonb_build_object(
    'totalProducts', COUNT(DISTINCT p.id),
    'totalLinks', COUNT(DISTINCT l.id),
    'totalClicks', COALESCE(SUM(l.click_count), 0),
    'topKeywords', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('keyword', k.name, 'usage', k.usage_count))
      FROM (
        SELECT name, usage_count 
        FROM public.keywords 
        WHERE user_id = user_uuid 
        ORDER BY usage_count DESC 
        LIMIT 5
      ) k
    ), '[]'::jsonb),
    'recentLinks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rl.id,
        'url', rl.url,
        'type', rl.link_type,
        'clicks', rl.click_count,
        'createdAt', rl.created_at,
        'asin', rp.asin,
        'marketplace', rp.marketplace
      ))
      FROM (
        SELECT gl.id, gl.url, gl.link_type, gl.click_count, gl.created_at, gl.product_id
        FROM public.generated_links gl
        WHERE gl.user_id = user_uuid
        ORDER BY gl.created_at DESC
        LIMIT 10
      ) rl
      JOIN public.products rp ON rl.product_id = rp.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.products p
  LEFT JOIN public.generated_links l ON p.id = l.product_id
  WHERE p.user_id = user_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomically increment click counts for a link
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generated_links 
  SET click_count = click_count + 1, updated_at = NOW()
  WHERE id = link_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
