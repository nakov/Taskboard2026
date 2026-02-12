# Taskboard

Vite-based multi-page-ready app scaffold with modular page and component structure.

## Available routes

- `/` -> index page
- `/dashboard` -> dashboard page
- `/login` -> login page
- `/register` -> register page

## Supabase setup

Create a `.env` file with:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run seed` - Seed database with sample data (see [scripts/README.md](scripts/README.md))

## Database Setup

### 1. Apply Migrations

Apply the database schema migration in your Supabase project:

```sql
-- Run the migration file: supabase/migrations/20260212120000_initial_schema.sql
-- in the Supabase SQL Editor
```

### 2. Seed Sample Data (Optional)

To populate the database with sample users, projects, and tasks:

1. Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env` file (get it from Supabase Dashboard > Settings > API)
2. Run: `npm run seed`

This creates:
- 3 sample users (steve@gmail.com, maria@gmail.com, peter@gmail.com - password: pass123)
- 4 sample projects
- Default stages (Not Started, In Progress, Done) for each project
- 10-12 tasks per project

See [scripts/README.md](scripts/README.md) for detailed instructions.

## Structure

- `src/pages/*` for page modules (`html`, `css`, `js`)
- `src/components/*` for reusable UI components (`html`, `css`, `js`)
- `src/router.js` for path navigation
