@AGENTS.md

## Local dev ports

- `npm run dev` (Turbopack dev server, live-reloading) runs on **port 3001**.
- Port 3000 is `npm run start` — a production server (`next start`) that snapshots the `.next` build at boot.
- If localhost:3000 ever renders unstyled/broken (CSS/JS chunk 404s), it's almost always a `next start` process left running from before a later `next build` regenerated `.next/static` — its in-memory manifest goes stale. Kill and restart it, or just use port 3001 for active development.
