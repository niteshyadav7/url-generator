# 🛒 Amazon Link Generator Dashboard
## Complete Supabase-First Technical Specification
## Open-Source Alternative | React + Supabase

---

## 📋 Table of Contents
1. [Project Overview](#1-project-overview)
2. [Supabase Architecture](#2-supabase-architecture)
3. [Database Schema (PostgreSQL)](#3-database-schema-postgresql)
4. [Supabase Services Setup](#4-supabase-services-setup)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Features Breakdown](#6-features-breakdown)
7. [CSV Upload Logic](#7-csv-upload-logic)
8. [Link Generation Engine](#8-link-generation-engine)
9. [Security (RLS Policies)](#9-security-rls-policies)
10. [Deployment Guide](#10-deployment-guide)
11. [Folder Structure](#11-folder-structure)

---

## 1. Project Overview

### Purpose
A full-stack web application using **Supabase** (open-source Firebase alternative). Takes Amazon product URLs and generates multiple link variations dynamically. Supports single URL input, bulk CSV upload, keyword management, and analytics — completely free forever on the generous tier.

### Why Supabase Over Firebase?
| Feature | Supabase | Firebase |
|---------|----------|----------|
| **Database** | PostgreSQL (real SQL) | Firestore (NoSQL) |
| **Free Tier** | Unlimited projects | 1 project limit |
| **Database Size** | 500MB | 1GB total |
| **API Requests** | Unlimited | 50K/day reads |
| **Auth Users** | Unlimited | 10K/month |
| **Storage** | 1GB | 5GB |
| **Edge Functions** | 500K invocations/month | 2M/month |
| **Real-time** | ✅ Built-in | ✅ Built-in |
| **Open Source** | ✅ Fully open | ❌ Google proprietary |
| **Self-hostable** | ✅ Docker | ❌ No |

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + shadcn/ui |
| State Management | React Query (TanStack Query) + Zustand |
| Backend | **Supabase** (Serverless) |
| Auth | **Supabase Auth** (PostgreSQL-based) |
| Database | **PostgreSQL** (via Supabase) |
| Real-time | **Supabase Realtime** (WebSocket) |
| File Storage | **Supabase Storage** |
| Serverless Functions | **Supabase Edge Functions** (Deno) |
| Hosting | **Vercel/Netlify** (free) or Supabase Static |
| QR Generation | `qrcode` library (client-side or Edge Function) |
| Validation | Zod |

---

## 2. Supabase Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Dashboard   │  │ CSV Upload  │  │ Link Management     │ │
│  │ (Home)      │  │ Page        │  │ Page                │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Analytics   │  │ Settings    │  │ Auth (Login/Reg)    │ │
│  │ Page        │  │ Page        │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / Supabase JS Client
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE PLATFORM                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Auth        │  │ PostgreSQL  │  │ Edge Functions      │ │
│  │ (GoTrue)    │  │ (Database)  │  │ (Deno/TypeScript)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Storage     │  │ Realtime    │  │ PostgREST API       │ │
│  │ (S3-compat) │  │ (WebSocket) │  │ (Auto-generated)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐                                            │
│  │ Row Level   │                                            │
│  │ Security    │                                            │
│  │ (RLS)       │                                            │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### Supabase Free Tier (Generous!)
- **Database**: 500MB PostgreSQL
- **Auth**: Unlimited users
- **Storage**: 1GB
- **Edge Functions**: 500K invocations/month
- **Bandwidth**: 2GB egress
- **API**: Unlimited requests
- **Projects**: Unlimited
- **Real-time**: Unlimited connections

---

## 3. Database Schema (PostgreSQL)

### 3.1 Users Table (managed by Supabase Auth)
```sql
-- Supabase Auth creates this automatically: auth.users
-- We extend it with a public profile:

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  affiliate_tag TEXT DEFAULT NULL,        -- Default affiliate ID
  default_marketplace TEXT DEFAULT 'amazon.in',
  theme_preference TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3.2 Products Table
```sql
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asin VARCHAR(10) NOT NULL CHECK (asin ~ '^[A-Z0-9]{10}$'),
  title TEXT,
  original_url TEXT NOT NULL,
  marketplace VARCHAR(50) DEFAULT 'amazon.in',
  image_url TEXT,
  keywords TEXT[] DEFAULT '{}',            -- Array of keywords
  total_links INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_products_asin ON public.products(asin);
CREATE INDEX idx_products_created_at ON public.products(created_at DESC);
```

### 3.3 Generated Links Table
```sql
CREATE TYPE link_type AS ENUM (
  'CLEAN', 'KEYWORD', 'AFFILIATE', 'AFFILIATE_KEYWORD', 
  'UTM', 'SHORTENED', 'QR', 'SEARCH_PAGE', 'VARIANT'
);

CREATE TABLE public.generated_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  link_type link_type NOT NULL,
  url TEXT NOT NULL,
  short_code VARCHAR(10) UNIQUE,           -- Custom short code
  short_url TEXT,

  -- Dynamic parameters
  keywords TEXT[],                         -- Array of keywords used
  affiliate_tag TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  variant_params TEXT,

  -- Metadata
  click_count INTEGER DEFAULT 0,
  qr_code_url TEXT,                        -- Storage URL

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_links_user_id ON public.generated_links(user_id);
CREATE INDEX idx_generated_links_product_id ON public.generated_links(product_id);
CREATE INDEX idx_generated_links_type ON public.generated_links(link_type);
CREATE INDEX idx_generated_links_short_code ON public.generated_links(short_code);
CREATE INDEX idx_generated_links_created_at ON public.generated_links(created_at DESC);
```

### 3.4 Keywords Table (Reusable Library)
```sql
CREATE TABLE public.keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  category TEXT,                           -- e.g., 'beauty', 'electronics'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE INDEX idx_keywords_user_id ON public.keywords(user_id);
CREATE INDEX idx_keywords_usage ON public.keywords(usage_count DESC);
```

### 3.5 Link Clicks Analytics
```sql
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
  device_type TEXT,                        -- mobile, desktop, tablet

  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX idx_link_clicks_user_id ON public.link_clicks(user_id);
CREATE INDEX idx_link_clicks_clicked_at ON public.link_clicks(clicked_at DESC);
```

### 3.6 CSV Upload Jobs
```sql
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE public.csv_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  status job_status DEFAULT 'pending',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,                 -- Supabase Storage path

  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- JSONB for flexible error reporting
  errors JSONB DEFAULT '[]',
  results JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_csv_jobs_user_id ON public.csv_jobs(user_id);
CREATE INDEX idx_csv_jobs_status ON public.csv_jobs(status);
```

### 3.7 Templates Table
```sql
CREATE TABLE public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Configuration stored as JSONB
  config JSONB NOT NULL DEFAULT '{
    "linkTypes": ["CLEAN", "KEYWORD"],
    "keywords": [],
    "utmParams": {}
  }',

  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.8 Database Functions (RPC)
```sql
-- Function to generate short code and check uniqueness
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

-- Function to get analytics dashboard data
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalProducts', COUNT(DISTINCT p.id),
    'totalLinks', COUNT(DISTINCT l.id),
    'totalClicks', COALESCE(SUM(l.click_count), 0),
    'topKeywords', (
      SELECT jsonb_agg(jsonb_build_object('keyword', k.name, 'usage', k.usage_count))
      FROM public.keywords k WHERE k.user_id = user_uuid ORDER BY k.usage_count DESC LIMIT 5
    ),
    'recentLinks', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'url', l.url,
        'type', l.link_type,
        'clicks', l.click_count,
        'createdAt', l.created_at
      ))
      FROM public.generated_links l 
      WHERE l.user_id = user_uuid 
      ORDER BY l.created_at DESC LIMIT 10
    )
  )
  INTO result
  FROM public.products p
  LEFT JOIN public.generated_links l ON p.id = l.product_id
  WHERE p.user_id = user_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment click count atomically
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generated_links 
  SET click_count = click_count + 1, updated_at = NOW()
  WHERE id = link_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Supabase Services Setup

### 4.1 Supabase Client Configuration
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Typed Supabase client (for TypeScript)
import type { Database } from './database.types';
export const typedSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### 4.2 Environment Variables
```env
# Client (.env)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_NAME=Amazon Link Gen

# Server/Edge Functions (.env.local)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### 4.3 Edge Functions (Deno/TypeScript)
```typescript
// supabase/functions/generate-links/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, keywords, linkTypes, affiliateTag, utmParams } = await req.json();

    // Create Supabase client with auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get user from auth context
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Extract ASIN
    const asin = extractASIN(url);
    if (!asin) throw new Error('Invalid Amazon URL - ASIN not found');

    // Detect marketplace
    const marketplace = detectMarketplace(url);

    // Insert product
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .insert({
        user_id: user.id,
        asin,
        original_url: url,
        marketplace: marketplace.domain,
        keywords: keywords || []
      })
      .select()
      .single();

    if (productError) throw productError;

    // Generate links
    const generatedLinks = [];
    for (const type of linkTypes) {
      const linkUrl = generateLinkUrl(asin, marketplace.domain, type, {
        keywords,
        affiliateTag,
        utmParams
      });

      const shortCode = generateShortCode();

      generatedLinks.push({
        product_id: product.id,
        user_id: user.id,
        link_type: type,
        url: linkUrl,
        short_code: shortCode,
        short_url: `${Deno.env.get('APP_URL')}/s/${shortCode}`,
        keywords: keywords || null,
        affiliate_tag: affiliateTag || null,
        utm_source: utmParams?.source || null,
        utm_medium: utmParams?.medium || null,
        utm_campaign: utmParams?.campaign || null
      });
    }

    // Bulk insert links
    const { data: links, error: linksError } = await supabaseClient
      .from('generated_links')
      .insert(generatedLinks)
      .select();

    if (linksError) throw linksError;

    // Update product link count
    await supabaseClient
      .from('products')
      .update({ total_links: generatedLinks.length })
      .eq('id', product.id);

    return new Response(
      JSON.stringify({ success: true, product, links }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions
function extractASIN(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /[?&]asin=([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function detectMarketplace(url: string) {
  const hostname = new URL(url).hostname.replace('www.', '');
  const domains: Record<string, string> = {
    'amazon.com': 'amazon.com',
    'amazon.in': 'amazon.in',
    'amazon.co.uk': 'amazon.co.uk',
    'amazon.ca': 'amazon.ca',
    'amazon.de': 'amazon.de',
  };
  return { domain: domains[hostname] || 'amazon.com' };
}

function generateLinkUrl(
  asin: string,
  marketplace: string,
  type: string,
  params: any
): string {
  const base = `https://www.${marketplace}/dp/${asin}`;

  switch (type) {
    case 'CLEAN':
      return base;
    case 'KEYWORD':
      return `${base}?keywords=${encodeURIComponent(params.keywords?.join('+') || '')}`;
    case 'AFFILIATE':
      return `${base}?tag=${params.affiliateTag}`;
    case 'AFFILIATE_KEYWORD':
      return `${base}?tag=${params.affiliateTag}&keywords=${encodeURIComponent(params.keywords?.join('+') || '')}`;
    case 'UTM':
      const utm = new URLSearchParams();
      if (params.utmParams?.source) utm.set('utm_source', params.utmParams.source);
      if (params.utmParams?.medium) utm.set('utm_medium', params.utmParams.medium);
      if (params.utmParams?.campaign) utm.set('utm_campaign', params.utmParams.campaign);
      return `${base}?${utm.toString()}`;
    case 'SEARCH_PAGE':
      return `https://www.${marketplace}/s?k=${encodeURIComponent(params.keywords?.join('+') || '')}`;
    default:
      return base;
  }
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

### 4.4 CSV Processing Edge Function
```typescript
// supabase/functions/process-csv/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse } from 'https://deno.land/std@0.168.0/csv/mod.ts';

serve(async (req) => {
  const { jobId } = await req.json();

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get job details
  const { data: job } = await supabaseAdmin
    .from('csv_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error('Job not found');

  // Download file from Storage
  const { data: fileData } = await supabaseAdmin
    .storage
    .from('csv-uploads')
    .download(job.file_path);

  const csvText = await fileData.text();
  const rows = parse(csvText, { skipFirstRow: true, columns: ['url', 'keywords', 'affiliate_tag'] });

  // Update total rows
  await supabaseAdmin
    .from('csv_jobs')
    .update({ status: 'processing', total_rows: rows.length })
    .eq('id', jobId);

  // Process in batches
  const batchSize = 10;
  const errors = [];
  const results = { products: [], links: [] };

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    await Promise.all(batch.map(async (row, index) => {
      try {
        const asin = extractASIN(row.url);
        if (!asin) throw new Error('ASIN not found');

        // Insert product
        const { data: product } = await supabaseAdmin
          .from('products')
          .insert({
            user_id: job.user_id,
            asin,
            original_url: row.url,
            marketplace: detectMarketplace(row.url).domain,
            keywords: row.keywords ? row.keywords.split(',').map((k: string) => k.trim()) : []
          })
          .select()
          .single();

        // Generate links
        const keywords = row.keywords ? row.keywords.split(',').map((k: string) => k.trim()) : [];
        const linkTypes = ['CLEAN', 'KEYWORD', 'AFFILIATE'];

        const links = linkTypes.map(type => ({
          product_id: product.id,
          user_id: job.user_id,
          link_type: type,
          url: generateLinkUrl(asin, product.marketplace, type, {
            keywords,
            affiliateTag: row.affiliate_tag
          }),
          short_code: generateShortCode(),
          keywords: keywords.length > 0 ? keywords : null,
          affiliate_tag: row.affiliate_tag || null
        }));

        const { data: insertedLinks } = await supabaseAdmin
          .from('generated_links')
          .insert(links)
          .select();

        results.products.push(product.id);
        results.links.push(...insertedLinks.map((l: any) => l.id));

      } catch (error) {
        errors.push({ row: i + index + 1, url: row.url, error: error.message });
      }
    }));

    // Update progress
    await supabaseAdmin
      .from('csv_jobs')
      .update({
        processed_rows: Math.min(i + batchSize, rows.length),
        success_count: results.products.length,
        failed_count: errors.length
      })
      .eq('id', jobId);
  }

  // Mark complete
  await supabaseAdmin
    .from('csv_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      errors: JSON.stringify(errors),
      results: JSON.stringify(results)
    })
    .eq('id', jobId);

  return new Response(JSON.stringify({ success: true, summary: results }));
});
```

---

## 5. Frontend Architecture

### 5.1 Route Structure
```
/                    → Dashboard (Home)
/login               → Login Page (Supabase Auth)
/register            → Register Page
/links               → All Links Management
/links/:id           → Link Detail & Stats
/products            → All Products
/products/:id        → Product Detail
/upload              → CSV Upload Page
/keywords            → Keyword Management
/analytics           → Analytics Dashboard
/settings            → User Settings
/s/:shortCode        → Short URL redirect handler
```

### 5.2 Supabase React Query Hooks
```typescript
// hooks/useSupabase.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Real-time products hook
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });
}

// Real-time subscription hook
export function useRealtimeProducts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = supabase
      .channel('products_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [queryClient]);
}

// Generate links mutation (calls Edge Function)
export function useGenerateLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GenerateParams) => {
      const { data, error } = await supabase.functions.invoke('generate-links', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['links'] });
    }
  });
}

// CSV upload with progress tracking
export function useCSVUpload() {
  const [progress, setProgress] = useState(0);

  const upload = async (file: File) => {
    // 1. Upload to Supabase Storage
    const filePath = `uploads/${userId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('csv-uploads')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Create job record
    const { data: job } = await supabase
      .from('csv_jobs')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_path: filePath,
        status: 'pending'
      })
      .select()
      .single();

    // 3. Call Edge Function to process
    await supabase.functions.invoke('process-csv', {
      body: { jobId: job.id }
    });

    // 4. Subscribe to real-time progress
    const subscription = supabase
      .channel(`csv_job_${job.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'csv_jobs', filter: `id=eq.${job.id}` },
        (payload) => {
          const updated = payload.new;
          setProgress((updated.processed_rows / updated.total_rows) * 100);

          if (updated.status === 'completed') {
            subscription.unsubscribe();
          }
        }
      )
      .subscribe();

    return job;
  };

  return { upload, progress };
}
```

### 5.3 Zustand Auth Store (Supabase)
```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,

  initialize: () => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        isAuthenticated: !!session
      });
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        isAuthenticated: !!session
      });
    });
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  register: async (email, password, name) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    if (error) throw error;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, isAuthenticated: false });
  }
}));
```

---

## 6. Features Breakdown

### 6.1 Single URL Generation
```
┌─────────────────────────────────────────┐
│  🛒 Generate Amazon Links               │
├─────────────────────────────────────────┤
│                                         │
│  Paste Amazon URL:                      │
│  [https://amazon.in/dp/B0CJRTFY9F___]   │
│                                         │
│  Auto-detected:                         │
│  ✅ ASIN: B0CJRTFY9F                    │
│  🌐 Marketplace: amazon.in             │
│                                         │
│  Select Link Types:                     │
│  ☑️ Clean URL                           │
│  ☑️ Keyword Targeted                    │
│  ☑️ Affiliate Link                      │
│  ☐ UTM Tracking                         │
│  ☐ QR Code                             │
│  ☐ Search Page Link                     │
│                                         │
│  Keywords (tag input):                   │
│  [instant mask] [spotlight] [+]        │
│  💡 Suggestions: spotlist, detanning    │
│                                         │
│  Affiliate Tag: [mytag-21____]          │
│                                         │
│  UTM Parameters:                        │
│  Source: [instagram____]                │
│  Medium: [social______]                 │
│  Campaign: [summer_sale]                │
│                                         │
│  [✨ GENERATE LINKS]                    │
│                                         │
│  Live Preview:                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  🔗 Clean: amazon.in/dp/B0CJRTFY9F      │
│  🔗 Keyword: ...?keywords=instant+mask  │
│  🔗 Affiliate: ...?tag=mytag-21         │
│  🔗 Short: your.app/s/a1b2c3d           │
│                                         │
│  [💾 Save to Dashboard]                 │
└─────────────────────────────────────────┘
```

### 6.2 Bulk CSV Upload (Supabase Storage + Edge Functions)
```
Flow:
1. User drags CSV → Client uploads to Supabase Storage
2. Client inserts job record in PostgreSQL
3. Client calls Edge Function `process-csv`
4. Edge Function:
   a. Downloads CSV from Storage
   b. Parses with Deno CSV parser
   c. Validates each URL (ASIN extraction)
   d. Generates links for each row
   e. Inserts products + links in batches
   f. Updates progress in csv_jobs table
5. Client subscribes to real-time updates on csv_jobs
6. Progress bar updates live via WebSocket
7. Results displayed when status = 'completed'
```

### 6.3 Real-Time Dashboard
```
┌─────────────────────────────────────────┐
│  📊 Dashboard (Real-time via WebSocket) │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ 24     │ │ 156    │ │ 1.2k   │      │
│  │Products│ │ Links  │ │ Clicks │      │
│  └────────┘ └────────┘ └────────┘      │
│                                         │
│  Live Activity Stream                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  🟢 10:42 AM - Generated 5 links        │
│  🟢 10:38 AM - CSV upload completed    │
│  🟡 10:35 AM - Link clicked (×3)       │
│  🔵 10:30 AM - New keyword added        │
│                                         │
│  Top Performing Links                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  1. Mask Spotlight - 45 clicks          │
│  2. Instant Mask - 32 clicks            │
│  3. Spotlist Mask - 28 clicks           │
│                                         │
│  [📈 View Full Analytics]               │
└─────────────────────────────────────────┘
```

### 6.4 Dynamic Features
| Feature | Implementation |
|---------|---------------|
| **Dynamic ASIN Extraction** | Regex in Edge Function + client preview |
| **Dynamic Marketplace Detection** | URL parsing, auto-detect 10+ countries |
| **Dynamic Keyword Suggestions** | PostgreSQL query of user's keywords table |
| **Dynamic UTM Builder** | Template system from templates table |
| **Dynamic Link Preview** | Live URL construction with React state |
| **Dynamic QR Generation** | `qrcode` library in Edge Function |
| **Dynamic Short URLs** | Auto-generated short_code, stored in PostgreSQL |
| **Real-time Updates** | Supabase Realtime subscriptions |
| **Dynamic Analytics** | PostgreSQL aggregation queries + RPC |

---

## 7. CSV Upload Logic (Supabase)

### 7.1 Client-Side Upload Component
```typescript
// components/upload/CSVUploader.tsx
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../lib/supabase';
import { useCSVUpload } from '../../hooks/useCSVUpload';

export function CSVUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const { upload, progress, job } = useCSVUpload();

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      await upload(files[0]);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  }, [upload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          {isDragActive ? 'Drop the CSV here...' : 'Drag & drop a CSV file, or click to select'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Max 10MB • Columns: url, keywords, affiliate_tag</p>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processing CSV...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {job && (
            <p className="text-xs text-gray-500">
              Processed {job.processed_rows} of {job.total_rows} rows
              • {job.success_count} success • {job.failed_count} failed
            </p>
          )}
        </div>
      )}

      {job?.status === 'completed' && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Upload Complete!</AlertTitle>
          <AlertDescription>
            Successfully processed {job.success_count} products.
            {job.failed_count > 0 && ` ${job.failed_count} rows failed.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### 7.2 CSV Template Download
```typescript
// components/upload/CSVTemplates.tsx
export function CSVTemplates() {
  const downloadTemplate = () => {
    const headers = ['url', 'keywords', 'affiliate_tag', 'utm_source', 'utm_medium', 'utm_campaign'];
    const sample = [
      'https://www.amazon.in/dp/B0CJRTFY9F',
      'instant mask,spotlight',
      'mytag-21',
      'instagram',
      'social',
      'summer_sale'
    ];

    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amazon_links_template.csv';
    a.click();
  };

  return (
    <Button variant="outline" onClick={downloadTemplate}>
      <Download className="mr-2 h-4 w-4" />
      Download CSV Template
    </Button>
  );
}
```

---

## 8. Link Generation Engine

### 8.1 ASIN Extraction (Universal)
```typescript
// utils/asinExtractor.ts
export function extractASIN(url: string): string | null {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/,
    /\/product\/([A-Z0-9]{10})/,
    /\/gp\/product\/([A-Z0-9]{10})/,
    /\/ASIN\/([A-Z0-9]{10})/,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?]|$)/  // Fallback
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isValidAmazonUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('amazon.');
  } catch {
    return false;
  }
}
```

### 8.2 Marketplace Detection
```typescript
// utils/marketplace.ts
export interface Marketplace {
  domain: string;
  code: string;
  currency: string;
  country: string;
}

export function detectMarketplace(url: string): Marketplace {
  const hostname = new URL(url).hostname.replace('www.', '');

  const marketplaces: Record<string, Marketplace> = {
    'amazon.com': { domain: 'amazon.com', code: 'US', currency: 'USD', country: 'United States' },
    'amazon.in': { domain: 'amazon.in', code: 'IN', currency: 'INR', country: 'India' },
    'amazon.co.uk': { domain: 'amazon.co.uk', code: 'UK', currency: 'GBP', country: 'United Kingdom' },
    'amazon.ca': { domain: 'amazon.ca', code: 'CA', currency: 'CAD', country: 'Canada' },
    'amazon.de': { domain: 'amazon.de', code: 'DE', currency: 'EUR', country: 'Germany' },
    'amazon.fr': { domain: 'amazon.fr', code: 'FR', currency: 'EUR', country: 'France' },
    'amazon.jp': { domain: 'amazon.jp', code: 'JP', currency: 'JPY', country: 'Japan' },
    'amazon.com.au': { domain: 'amazon.com.au', code: 'AU', currency: 'AUD', country: 'Australia' },
    'amazon.it': { domain: 'amazon.it', code: 'IT', currency: 'EUR', country: 'Italy' },
    'amazon.es': { domain: 'amazon.es', code: 'ES', currency: 'EUR', country: 'Spain' },
    'amazon.com.mx': { domain: 'amazon.com.mx', code: 'MX', currency: 'MXN', country: 'Mexico' },
    'amazon.com.br': { domain: 'amazon.com.br', code: 'BR', currency: 'BRL', country: 'Brazil' }
  };

  return marketplaces[hostname] || { 
    domain: 'amazon.com', 
    code: 'US', 
    currency: 'USD', 
    country: 'United States' 
  };
}
```

### 8.3 Link Type Generators
```typescript
// utils/linkGenerators.ts
export interface LinkParams {
  keywords?: string[];
  affiliateTag?: string;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
  variant?: string;
}

export const generators = {
  CLEAN: (asin: string, marketplace: string, _params: LinkParams) => 
    `https://www.${marketplace}/dp/${asin}`,

  KEYWORD: (asin: string, marketplace: string, params: LinkParams) => {
    const keywordStr = params.keywords?.join('+') || '';
    return `https://www.${marketplace}/dp/${asin}?keywords=${encodeURIComponent(keywordStr)}`;
  },

  AFFILIATE: (asin: string, marketplace: string, params: LinkParams) => 
    `https://www.${marketplace}/dp/${asin}?tag=${params.affiliateTag}`,

  AFFILIATE_KEYWORD: (asin: string, marketplace: string, params: LinkParams) => {
    const keywordStr = params.keywords?.join('+') || '';
    return `https://www.${marketplace}/dp/${asin}?tag=${params.affiliateTag}&keywords=${encodeURIComponent(keywordStr)}`;
  },

  UTM: (asin: string, marketplace: string, params: LinkParams) => {
    const base = `https://www.${marketplace}/dp/${asin}`;
    const utm = new URLSearchParams();
    if (params.utmParams?.source) utm.set('utm_source', params.utmParams.source);
    if (params.utmParams?.medium) utm.set('utm_medium', params.utmParams.medium);
    if (params.utmParams?.campaign) utm.set('utm_campaign', params.utmParams.campaign);
    return `${base}?${utm.toString()}`;
  },

  SEARCH_PAGE: (_asin: string, marketplace: string, params: LinkParams) => {
    const keywordStr = params.keywords?.join('+') || '';
    return `https://www.${marketplace}/s?k=${encodeURIComponent(keywordStr)}`;
  },

  VARIANT: (asin: string, marketplace: string, params: LinkParams) => 
    `https://www.${marketplace}/dp/${asin}?${params.variant}`,

  QR: (asin: string, marketplace: string, params: LinkParams) => {
    // QR codes point to the clean URL or specified type
    return generators.CLEAN(asin, marketplace, params);
  }
};

export function generateLinkUrl(
  type: string,
  asin: string,
  marketplace: string,
  params: LinkParams
): string {
  const generator = generators[type as keyof typeof generators];
  if (!generator) throw new Error(`Unknown link type: ${type}`);
  return generator(asin, marketplace, params);
}
```

---

## 9. Security (RLS Policies)

### 9.1 Row Level Security Policies
```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Products: Users can only access their own products
CREATE POLICY "Users can view own products" 
  ON public.products FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own products" 
  ON public.products FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" 
  ON public.products FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" 
  ON public.products FOR DELETE 
  USING (auth.uid() = user_id);

-- Generated Links: Users can only access their own links
CREATE POLICY "Users can view own links" 
  ON public.generated_links FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own links" 
  ON public.generated_links FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own links" 
  ON public.generated_links FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own links" 
  ON public.generated_links FOR DELETE 
  USING (auth.uid() = user_id);

-- Keywords: Users can only access their own keywords
CREATE POLICY "Users can view own keywords" 
  ON public.keywords FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own keywords" 
  ON public.keywords FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own keywords" 
  ON public.keywords FOR DELETE 
  USING (auth.uid() = user_id);

-- Link Clicks: Users can only view their own click data
CREATE POLICY "Users can view own clicks" 
  ON public.link_clicks FOR SELECT 
  USING (auth.uid() = user_id);

-- CSV Jobs: Users can only access their own jobs
CREATE POLICY "Users can view own csv jobs" 
  ON public.csv_jobs FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own csv jobs" 
  ON public.csv_jobs FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Templates: Users can only access their own templates
CREATE POLICY "Users can view own templates" 
  ON public.templates FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own templates" 
  ON public.templates FOR ALL 
  USING (auth.uid() = user_id);
```

### 9.2 Storage Policies
```sql
-- Enable RLS on storage buckets
-- Users can only access their own uploads
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 10. Deployment Guide

### 10.1 Supabase Project Setup
```bash
# 1. Create Supabase project (via dashboard or CLI)
npm install -g supabase
supabase login
supabase projects create "amazon-link-generator"

# 2. Link local project
supabase link --project-ref your-project-ref

# 3. Run migrations
supabase db push

# 4. Deploy Edge Functions
supabase functions deploy generate-links
supabase functions deploy process-csv
supabase functions deploy short-redirect

# 5. Set secrets
supabase secrets set APP_URL=https://your-app.vercel.app
supabase secrets set BITLY_TOKEN=your_bitly_token
```

### 10.2 Frontend Deployment (Vercel - Free)
```bash
# 1. Build the React app
npm run build

# 2. Deploy to Vercel
npm install -g vercel
vercel --prod

# Or use GitHub integration for auto-deploy
```

### 10.3 Environment Variables
```env
# Client (.env)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://your-app.vercel.app

# Supabase Dashboard > Settings > API
# VITE_SUPABASE_ANON_KEY = anon/public key

# Edge Functions Secrets (Supabase Dashboard)
APP_URL=https://your-app.vercel.app
```

### 10.4 Custom Domain Setup
```
1. Vercel: Add custom domain in project settings
2. Supabase: Configure auth redirect URLs
   Dashboard > Authentication > URL Configuration
   - Site URL: https://yourdomain.com
   - Redirect URLs: https://yourdomain.com/**, http://localhost:5173/**
```

---

## 11. Folder Structure

```
amazon-link-generator-supabase/
├── 📁 client/                        # React Frontend
│   ├── 📁 src/
│   │   ├── 📁 components/
│   │   │   ├── 📁 ui/                # shadcn/ui components
│   │   │   ├── 📁 layout/            # Sidebar, TopBar, Layout
│   │   │   ├── 📁 links/             # LinkCard, LinkTable, LinkFilters
│   │   │   ├── 📁 products/          # ProductCard, ProductDetail
│   │   │   ├── 📁 upload/            # CSVUploader, Dropzone, Progress
│   │   │   ├── 📁 analytics/          # Charts, StatsCards, GeoMap
│   │   │   ├── 📁 keywords/          # KeywordInput, KeywordTags
│   │   │   └── 📁 common/            # Loader, Toast, Modal
│   │   ├── 📁 pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Links.jsx
│   │   │   ├── LinkDetail.jsx
│   │   │   ├── Upload.jsx
│   │   │   ├── Products.jsx
│   │   │   ├── ProductDetail.jsx
│   │   │   ├── Keywords.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── 📁 hooks/
│   │   │   ├── useAuth.js            # Supabase Auth
│   │   │   ├── useSupabase.js        # Database queries
│   │   │   ├── useRealtime.js        # Real-time subscriptions
│   │   │   ├── useLinks.js           # Link operations
│   │   │   ├── useProducts.js        # Product operations
│   │   │   ├── useCSV.js             # CSV upload
│   │   │   ├── useKeywords.js        # Keyword management
│   │   │   └── useAnalytics.js       # Stats & charts
│   │   ├── 📁 stores/
│   │   │   ├── authStore.js          # Zustand auth state
│   │   │   ├── linkStore.js          # Link filters
│   │   │   ├── uiStore.js            # Theme, sidebar
│   │   │   └── uploadStore.js        # CSV progress
│   │   ├── 📁 services/
│   │   │   ├── supabase.js           # Supabase client config
│   │   │   ├── authService.js        # Auth operations
│   │   │   ├── linkService.js        # Link generation
│   │   │   ├── productService.js     # Product CRUD
│   │   │   ├── csvService.js         # CSV processing
│   │   │   └── analyticsService.js   # Stats aggregation
│   │   ├── 📁 utils/
│   │   │   ├── asinExtractor.js      # ASIN regex
│   │   │   ├── marketplace.js        # Marketplace detection
│   │   │   ├── linkGenerators.js     # URL builders
│   │   │   ├── formatters.js         # Date/number format
│   │   │   ├── validators.js         # Zod schemas
│   │   │   └── constants.js          # App constants
│   │   ├── 📁 types/
│   │   │   └── database.types.ts     # Generated Supabase types
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── 📁 public/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env.example
│
├── 📁 supabase/                      # Supabase Project Config
│   ├── 📁 functions/                 # Edge Functions
│   │   ├── generate-links/
│   │   │   └── index.ts              # Single URL link generation
│   │   ├── process-csv/
│   │   │   └── index.ts              # CSV batch processing
│   │   ├── short-redirect/
│   │   │   └── index.ts              # Short URL redirect + click tracking
│   │   └── _shared/
│   │       ├── asinExtractor.ts      # Shared ASIN logic
│   │       ├── marketplace.ts        # Shared marketplace logic
│   │       └── linkGenerators.ts     # Shared URL builders
│   ├── 📁 migrations/                # Database migrations
│   │   ├── 001_initial_schema.sql    # All tables + RLS
│   │   ├── 002_functions.sql         # RPC functions
│   │   └── 003_indexes.sql           # Performance indexes
│   ├── config.toml                   # Supabase CLI config
│   └── seed.sql                      # Sample data
│
├── .gitignore
├── README.md
└── package.json                      # Root workspace config
```

---

## 🎯 Implementation Priority

### Phase 1: Foundation (Days 1-3)
- [ ] Supabase project setup
- [ ] Database schema + RLS policies
- [ ] React + Vite + Tailwind scaffold
- [ ] Supabase Auth integration
- [ ] Basic dashboard layout

### Phase 2: Core Features (Days 4-7)
- [ ] Single URL link generation (Edge Function)
- [ ] ASIN extraction + marketplace detection
- [ ] Link types: Clean, Keyword, Affiliate
- [ ] Save to PostgreSQL
- [ ] Links list with search/filter
- [ ] Copy to clipboard

### Phase 3: Bulk & Advanced (Days 8-12)
- [ ] CSV upload to Supabase Storage
- [ ] Edge Function CSV processor
- [ ] Real-time progress tracking
- [ ] QR code generation
- [ ] UTM parameter builder
- [ ] Keyword management page
- [ ] Templates system

### Phase 4: Analytics & Polish (Days 13-15)
- [ ] Click tracking (Edge Function redirect)
- [ ] Analytics dashboard with Recharts
- [ ] Product detail page
- [ ] Link detail with stats
- [ ] Dark mode
- [ ] Mobile responsive
- [ ] Deploy to Vercel

---

## 💰 Supabase Free Tier (Completely Free!)

| Service | Free Tier |
|---------|-----------|
| Database | 500MB PostgreSQL |
| Auth | Unlimited users |
| Storage | 1GB |
| Edge Functions | 500K invocations/month |
| Bandwidth | 2GB egress |
| API Requests | Unlimited |
| Projects | Unlimited |
| Real-time | Unlimited connections |

**Cost for any number of users: $0 FOREVER** (until you exceed limits)

---

*Document Version: 3.0 (Supabase Edition)*
*Last Updated: 2026-05-22*
*Architecture: Open-Source Serverless*
