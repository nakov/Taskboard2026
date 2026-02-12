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

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Structure

- `src/pages/*` for page modules (`html`, `css`, `js`)
- `src/components/*` for reusable UI components (`html`, `css`, `js`)
- `src/router.js` for path navigation
