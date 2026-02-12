create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_owner_id on public.projects(owner_id);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user_id on public.project_members(user_id);

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, position)
);

create index if not exists idx_project_stages_project_id on public.project_stages(project_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_id uuid not null references public.project_stages(id) on delete restrict,
  title text not null,
  description_html text,
  position integer not null check (position >= 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, position)
);

create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_stage_id on public.tasks(stage_id);
create index if not exists idx_tasks_project_done on public.tasks(project_id, done);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_task_stage_project()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.project_stages ps
    where ps.id = new.stage_id
      and ps.project_id = new.project_id
  ) then
    raise exception 'Task stage does not belong to the same project';
  end if;

  return new;
end;
$$;

create trigger trg_projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create trigger trg_project_stages_set_updated_at
before update on public.project_stages
for each row
execute function public.set_updated_at();

create trigger trg_tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create trigger trg_tasks_validate_stage_project
before insert or update on public.tasks
for each row
execute function public.validate_task_stage_project();

create or replace function public.user_has_project_access(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = auth.uid()
  );
$$;

grant execute on function public.user_has_project_access(uuid) to authenticated;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_stages enable row level security;
alter table public.tasks enable row level security;

create policy projects_select_access
on public.projects
for select
to authenticated
using (public.user_has_project_access(id));

create policy projects_insert_owner
on public.projects
for insert
to authenticated
with check (owner_id = auth.uid());

create policy projects_update_access
on public.projects
for update
to authenticated
using (public.user_has_project_access(id))
with check (public.user_has_project_access(id));

create policy projects_delete_access
on public.projects
for delete
to authenticated
using (public.user_has_project_access(id));

create policy project_members_select_self_or_owner
on public.project_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

create policy project_members_insert_owner_only
on public.project_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

create policy project_members_update_owner_only
on public.project_members
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

create policy project_members_delete_owner_only
on public.project_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.owner_id = auth.uid()
  )
);

create policy project_stages_select_access
on public.project_stages
for select
to authenticated
using (public.user_has_project_access(project_id));

create policy project_stages_insert_access
on public.project_stages
for insert
to authenticated
with check (public.user_has_project_access(project_id));

create policy project_stages_update_access
on public.project_stages
for update
to authenticated
using (public.user_has_project_access(project_id))
with check (public.user_has_project_access(project_id));

create policy project_stages_delete_access
on public.project_stages
for delete
to authenticated
using (public.user_has_project_access(project_id));

create policy tasks_select_access
on public.tasks
for select
to authenticated
using (public.user_has_project_access(project_id));

create policy tasks_insert_access
on public.tasks
for insert
to authenticated
with check (public.user_has_project_access(project_id));

create policy tasks_update_access
on public.tasks
for update
to authenticated
using (public.user_has_project_access(project_id))
with check (public.user_has_project_access(project_id));

create policy tasks_delete_access
on public.tasks
for delete
to authenticated
using (public.user_has_project_access(project_id));
