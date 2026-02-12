-- Enable RLS on all tables
-- Projects Table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project Stages Table
CREATE TABLE public.project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

-- Tasks Table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_project_owner(project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_id
    AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Create basic RLS policies

-- Projects: Users can view and manage their own projects
CREATE POLICY "Users can create their own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view their own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = owner_id);

-- Project Stages: Access controlled via project ownership
CREATE POLICY "Users can manage stages of their projects" 
ON public.project_stages FOR ALL 
USING (public.is_project_owner(project_id));

-- Tasks: Access controlled via project ownership
CREATE POLICY "Users can manage tasks of their projects" 
ON public.tasks FOR ALL 
USING (public.is_project_owner(project_id));
