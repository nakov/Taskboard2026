-- Fix parameter name ambiguity in RLS helper functions
--
-- Problem: The parameter name 'project_id' conflicts with column names,
-- causing PostgreSQL to compare pm.project_id = pm.project_id (always TRUE)
-- instead of pm.project_id = <parameter> (correct comparison)
--
-- Solution: Use $1, $2 notation to explicitly reference parameters

CREATE OR REPLACE FUNCTION public.is_project_owner(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = $1
    AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_project_owner_or_member(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = $1
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = $1
      AND pm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_access_task(task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = $1
      AND public.is_project_owner_or_member(t.project_id)
  );
$$ LANGUAGE sql SECURITY DEFINER;
