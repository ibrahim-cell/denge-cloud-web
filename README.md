# Denge Cloud Web

Responsive personal-finance PWA for Android and desktop browsers.

## Source layout

- `index.html` is the application entry point.
- `assets/brand/` contains the Denge logo and app icons.
- `cloud-config.js` contains the public Supabase project URL and publishable key.
- `cloud-sync.js` contains client-side authentication and synchronization logic.
- `public/` mirrors the static deployable site files for Vercel.

## Vercel

- Framework preset: **Other**
- Root directory: `./`
- Build command: leave empty
- Output directory: `public` (also defined in `vercel.json`)

Only the Supabase publishable key belongs in browser code. Never add a service-role or secret key to this repository.
