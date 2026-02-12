-- Grant SELECT permission on auth.users to authenticated users
-- This is needed so foreign key constraints can verify user existence
-- We only grant SELECT on specific columns for security
grant select (id, email) on auth.users to authenticated;

-- Alternatively, if you need access to more user info, you can grant select on all columns:
-- grant select on auth.users to authenticated;
