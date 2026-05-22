-- 001_initial_schema.sql
-- Initial Schema Setup for Amazon Link Generator Dashboard

-- Enable UUID generation extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Custom Types
CREATE TYPE public.link_type AS ENUM (
  'CLEAN', 'KEYWORD', 'AFFILIATE', 'AFFILIATE_KEYWORD', 
  'UTM', 'SHORTENED', 'QR', 'SEARCH_PAGE', 'VARIANT'
);

CREATE TYPE public.job_status AS ENUM (
  'pending', 'processing', 'completed', 'failed'
);

-- =========================================================================
-- 1. Profiles Table (extending auth.users)
-- =========================================================================
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

-- Trigger to create profile automatically on signup
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

-- =========================================================================
-- 2. Products Table
-- =========================================================================
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

-- =========================================================================
-- 3. Generated Links Table
-- =========================================================================
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

-- =========================================================================
-- 4. Keywords Table
-- =========================================================================
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

-- =========================================================================
-- 5. Link Clicks Table (Analytics)
-- =========================================================================
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

-- =========================================================================
-- 6. CSV Upload Jobs Table
-- =========================================================================
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

-- =========================================================================
-- 7. Templates Table
-- =========================================================================
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

-- =========================================================================
-- 8. Row Level Security (RLS) Policies
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profiles
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Products: Users can manage their own products
CREATE POLICY "Users can view own products" 
  ON public.products FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own products" 
  ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" 
  ON public.products FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" 
  ON public.products FOR DELETE USING (auth.uid() = user_id);

-- Generated Links: Users can manage their own links
CREATE POLICY "Users can view own links" 
  ON public.generated_links FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own links" 
  ON public.generated_links FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own links" 
  ON public.generated_links FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own links" 
  ON public.generated_links FOR DELETE USING (auth.uid() = user_id);

-- Keywords: Users can manage their own keywords
CREATE POLICY "Users can view own keywords" 
  ON public.keywords FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own keywords" 
  ON public.keywords FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keywords" 
  ON public.keywords FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keywords" 
  ON public.keywords FOR DELETE USING (auth.uid() = user_id);

-- Link Clicks: Users can view click analytics for their own links
CREATE POLICY "Users can view own clicks" 
  ON public.link_clicks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clicks" 
  ON public.link_clicks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CSV Jobs: Users can manage their own CSV upload jobs
CREATE POLICY "Users can view own csv jobs" 
  ON public.csv_jobs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own csv jobs" 
  ON public.csv_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own csv jobs" 
  ON public.csv_jobs FOR UPDATE USING (auth.uid() = user_id);

-- Templates: Users can manage their own templates
CREATE POLICY "Users can view own templates" 
  ON public.templates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own templates" 
  ON public.templates FOR ALL USING (auth.uid() = user_id);
