-- 002_functions.sql
-- Database Functions (RPC) for Amazon Link Generator

-- =========================================================================
-- 1. Function to generate a unique short code for redirection
-- =========================================================================
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

-- =========================================================================
-- 2. Function to fetch dashboard statistics in a single query
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Security check: Ensure that the executing user is the same as requested, or is superuser
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

-- =========================================================================
-- 3. Function to atomically increment click counts for a link
-- =========================================================================
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generated_links 
  SET click_count = click_count + 1, updated_at = NOW()
  WHERE id = link_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
