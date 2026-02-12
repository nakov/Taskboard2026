# Taskboard

Taskboard is a Trello-style project and task management app built with Vanilla JS, Bootstrap, and Supabase.

## Current routes

- `/` → landing page
- `/dashboard` → authenticated dashboard
- `/login` → login page (guest only)
- `/register` → registration page (guest only)
- `/projects` → project list (authenticated)
- `/projects/add` → create project (authenticated)
- `/projects/edit?id={projectId}` → edit project (authenticated)

## Tech stack

- Frontend: Vanilla JS (ES modules), Bootstrap, Vite
- Backend/Auth/DB: Supabase + PostgreSQL + Supabase Auth
- Deployment: Netlify (SPA redirect configured in `netlify.toml`)

## Environment setup

Create either `.env` or `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Commands

- `npm install` — install dependencies
- `npm run dev` — start development server
- `npm run build` — build for production
- `npm run preview` — preview production build
- `npm run seed` — seed sample users/projects/stages/tasks

## Database setup

### 1) Apply migration

Run the SQL from:

- `supabase/migrations/20260212120000_initial_schema.sql`

This creates:

- `projects`
- `project_stages`
- `tasks`
- RLS policies for owner-scoped access

### 2) Seed sample data (optional)

Run:

```bash
npm run seed
```

The seed script creates/reuses 3 sample users, 4 projects, default stages, and sample tasks.

Detailed seed docs: [supabase/seed-data/README.md](supabase/seed-data/README.md)

## Project structure

- `src/pages/*` — page modules (`html`, `css`, `js`)
- `src/components/*` — reusable UI modules
- `src/router.js` — client-side route handling + auth guards
- `src/lib/supabaseClient.js` — Supabase client initialization
- `supabase/migrations/*` — SQL migrations
- `supabase/seed-data/*` — database seed scripts and docs
