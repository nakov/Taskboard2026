-- Set default value for owner_id to use the authenticated user's ID
alter table public.projects 
  alter column owner_id set default auth.uid();

-- Drop the old insert policy
drop policy if exists projects_insert_owner on public.projects;

-- Create a new insert policy that ensures owner_id equals the authenticated user
-- Even if someone tries to set it manually, the check will enforce it matches auth.uid()
create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
);
