# Database Seed Script

This script populates the Taskboard database with sample data for local development and testing.

## What it does

The seed script:

1. Creates (or reuses) 3 sample users:
   - steve@gmail.com / pass123
   - maria@gmail.com / pass123
   - peter@gmail.com / pass123
2. Creates 4 sample projects:
   - Website Redesign
   - Mobile App Development
   - Marketing Campaign Q1
   - Office Space Renovation
3. Creates default stages per project:
   - Not Started
   - In Progress
   - Done
4. Creates ~10-12 tasks per project and maps them to stages

## Prerequisites

### 1) Environment variables

The script loads variables from `.env.local` at the project root.

Required variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Example `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2) Install dependencies

```bash
npm install
```

### 3) Apply database migration

Make sure schema migration `supabase/migrations/20260212120000_initial_schema.sql` is already applied.

## Run the seed

From the project root:

```bash
npm run seed
```

This runs:

```bash
node supabase/seed-data/seed-sample-db-data.js
```

## Expected behavior

- Existing users are reused when login succeeds.
- Existing projects (same owner + title) are skipped.
- New projects get 3 stages and their sample tasks.
- The script prints a final summary with user/project/task counts.

## Troubleshooting

### "Missing Supabase env vars"

Ensure `.env.local` exists in the repository root and includes both required variables.

### Authentication or signup errors

Check:

1. Supabase URL and anon key are correct
2. Auth email/password sign-in is enabled
3. If email confirmation is required in your project, users may not be able to sign in immediately after signup

### Permission / RLS errors

Check:

1. Migration `20260212120000_initial_schema.sql` is applied
2. RLS policies allow authenticated users to create/read their own projects, stages, and tasks

## Reset / cleanup

To remove seeded data:

1. Delete created projects from the database/dashboard
2. Delete sample users from Supabase Auth
3. Or reset database and re-run migrations

## Customize sample data

Edit `supabase/seed-data/seed-sample-db-data.js`:

- `users` array: sample accounts
- `defaultStages` array: initial board columns
- `projectTemplates` array: sample projects and tasks

## High-level script flow

```javascript
dotenv.config({ path: '.env.local' });
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 1) Create/reuse users via sign-in or sign-up
await supabase.auth.signInWithPassword(...);
await supabase.auth.signUp(...);

// 2) Sign in as each user
await supabase.auth.signInWithPassword(...);

// 3) Insert projects, stages, tasks
await supabase.from('projects').insert(...);
await supabase.from('project_stages').insert(...);
await supabase.from('tasks').insert(...);
```
