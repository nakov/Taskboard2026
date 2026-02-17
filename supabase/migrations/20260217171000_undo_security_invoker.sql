-- UNDO: Restore SECURITY DEFINER to prevent infinite recursion
-- 
-- Problem: SECURITY INVOKER causes infinite recursion:
-- RLS policy calls function -> function queries table -> RLS policy calls function -> infinite loop
--
-- Solution: Restore SECURITY DEFINER which bypasses RLS in the function,
-- preventing recursion.

CREATE OR REPLACE FUNCTION public.is_project_owner(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_id
    AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_project_owner_or_member(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id
      AND p.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_access_task(task_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND public.is_project_owner_or_member(t.project_id)
  );
$$ LANGUAGE sql SECURITY DEFINER;
