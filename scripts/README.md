# Database Seed Script

This script populates the Taskboard database with sample data for testing and development.

## What it does

The seed script performs the following operations:

1. **Registers sample users** in Supabase Auth:
   - steve@gmail.com / pass123
   - maria@gmail.com / pass123
   - peter@gmail.com / pass123

2. **Creates 4 sample projects**:
   - Website Redesign
   - Mobile App Development
   - Marketing Campaign Q1
   - Office Space Renovation

3. **Defines default stages** for each project:
   - Not Started
   - In Progress
   - Done

4. **Creates 10-12 sample tasks** for each project, distributed across different stages

## Prerequisites

Before running the seed script, you need:

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for creating users)

> ⚠️ **Important**: The `SUPABASE_SERVICE_ROLE_KEY` is required to create users programmatically. You can find this in your Supabase Dashboard under Settings > API. Never commit this key to version control!

### 2. Install Dependencies

Make sure all dependencies are installed:

```bash
npm install
```

### 3. Database Migration

Ensure your database schema is up to date by running the migration:

```sql
-- Apply the migration in Supabase SQL Editor or via the Supabase CLI
```

## Running the Seed Script

To seed the database with sample data:

```bash
npm run seed
```

The script will:
1. Register the three sample users (or skip if they already exist)
2. Create projects for each user
3. Add stages to each project
4. Create tasks in different stages for each project
5. Display a summary of created data

## Expected Output

```
🌱 Starting database seed...

============================================================

🔹 STEP 1: Creating users
============================================================

📝 Registering user: steve@gmail.com
   ✅ User steve@gmail.com created successfully

📝 Registering user: maria@gmail.com
   ✅ User maria@gmail.com created successfully

📝 Registering user: peter@gmail.com
   ✅ User peter@gmail.com created successfully

✅ Successfully processed 3 users

🔹 STEP 2: Creating projects with stages and tasks
============================================================

📁 Creating project "Website Redesign" for steve@gmail.com
   ✅ Project created: Website Redesign
   ✅ Created 3 stages
   ✅ Created 10 tasks

...

============================================================

🎉 Seed completed successfully!

📊 Summary:
   • Users: 3
   • Projects: 4
   • Stages per project: 3
   • Tasks per project: ~10

💡 You can now log in with any of these accounts:
   • steve@gmail.com / pass123
   • maria@gmail.com / pass123
   • peter@gmail.com / pass123
```

## Troubleshooting

### "Missing Supabase env vars" error

Make sure you have created a `.env` file with all required variables. Check that the file is in the root directory of the project.

### "User already exists" error

The script will automatically skip users that already exist. This is normal if you've run the seed script before.

### RLS Policy errors

Make sure:
1. Your database migration has been applied (`20260212120000_initial_schema.sql`)
2. RLS policies are properly configured
3. The service role key has admin privileges

### Authentication errors

Verify that:
- Your Supabase project is active
- The service role key is correct
- Email confirmation is not required (the script auto-confirms emails)

## Cleaning Up

To remove seeded data:

1. Delete projects from the Supabase Dashboard
2. Delete users from Authentication > Users in the Supabase Dashboard
3. Or reset your database and re-run migrations

## Customizing Sample Data

To customize the sample data, edit [scripts/seed.js](scripts/seed.js):

- **Users**: Modify the `users` array
- **Stages**: Modify the `defaultStages` array
- **Projects**: Modify the `projectTemplates` array
- **Tasks**: Add/remove tasks in each project template

## Script Structure

```javascript
// 1. Create Supabase clients (admin + regular)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Register users using admin client
await supabaseAdmin.auth.admin.createUser({...});

// 3. Sign in as each user to create their projects
await supabase.auth.signInWithPassword({...});

// 4. Create projects, stages, and tasks
await supabase.from('projects').insert({...});
await supabase.from('project_stages').insert([...]);
await supabase.from('tasks').insert([...]);
```

The script uses the service role key to create users, then signs in as each user to create projects (respecting RLS policies).
