CREATE OR REPLACE FUNCTION public.search_project_users(search_term TEXT DEFAULT '', max_results INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT
) AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(u.email, '@', 1)) AS full_name
  FROM auth.users u
  WHERE auth.uid() IS NOT NULL
    AND (
      search_term IS NULL
      OR search_term = ''
      OR u.email ILIKE '%' || search_term || '%'
      OR COALESCE(u.raw_user_meta_data ->> 'full_name', '') ILIKE '%' || search_term || '%'
    )
  ORDER BY
    CASE
      WHEN search_term IS NULL OR search_term = '' THEN 1
      WHEN u.email ILIKE search_term || '%' THEN 0
      ELSE 1
    END,
    u.email ASC
  LIMIT LEAST(GREATEST(COALESCE(max_results, 20), 1), 50);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_project_users_by_ids(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT
) AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), SPLIT_PART(u.email, '@', 1)) AS full_name
  FROM auth.users u
  WHERE auth.uid() IS NOT NULL
    AND user_ids IS NOT NULL
    AND u.id = ANY(user_ids)
  ORDER BY u.email ASC;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.search_project_users(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_users_by_ids(UUID[]) TO authenticated;
