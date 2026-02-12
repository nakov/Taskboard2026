-- Create a trigger function to automatically set the owner_id to the authenticated user's ID
create or replace function public.handle_project_insertion()
returns trigger
language plpgsql
security definer
as $$
begin
  new.owner_id := auth.uid();
  return new;
end;
$$;

-- Create the trigger on the projects table
drop trigger if exists trg_set_project_owner on public.projects;

create trigger trg_set_project_owner
before insert on public.projects
for each row
execute function public.handle_project_insertion();

-- Ensure the insert policy is correct and allows the operation
drop policy if exists projects_insert_owner on public.projects;

create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
);
