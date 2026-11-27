# Denge Cloud Web

Responsive personal-finance PWA for Android and desktop browsers.

## Source layout

- `index.html` is the editable application source.
- `public/index.html` mirrors the deployable application and must be kept byte-for-byte identical to `index.html`.
- `assets/brand/` contains the Denge logo and app icons.
- `cloud-config.js` contains the public Supabase project URL and publishable key.
- `cloud-sync.js` contains client-side authentication and synchronization logic.
- `export-tools.js` contains backup and export helpers.

## Financial model

See [docs/FINANCIAL_MODEL.md](docs/FINANCIAL_MODEL.md) for the account ledger, credit-card available-limit model, dated limit changes, historical balances, warning behavior, and legacy-data limitations.

**Source of truth:** account balances are derived from opening balances and the signed transaction ledger. Do not independently mutate a displayed or cached balance when saving a transaction.

## Vercel

- Framework preset: **Other**
- Root directory: `./`
- Build command: leave empty
- Output directory: `public` (also defined in `vercel.json`)

Only the Supabase publishable key belongs in browser code. Never add a service-role or secret key to this repository.
