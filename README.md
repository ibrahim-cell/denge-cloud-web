# Denge Cloud Web

This repository hosts the responsive Denge Cloud web/PWA app.

## Upload the release package

1. Download `Denge-Cloud-Web-1.1.1-Vercel-Ready.zip` from the ChatGPT conversation.
2. In this repository choose **Add file → Upload files**.
3. Upload that single ZIP file to the repository root (do not extract it and do not create folders).
4. Commit the upload to `main`.

GitHub Actions will unpack it automatically and commit the app files, including `assets/brand/`, into the repository root. When the workflow finishes, `index.html` will be at the root, ready for Vercel import.

## Vercel

- Framework preset: Other
- Root directory: `./`
- Build command: leave empty
- Output directory: leave empty

The Supabase browser configuration contains only the project's public publishable key. Never add a service-role or secret key to this repository.
