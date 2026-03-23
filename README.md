# Operations CCTV Dashboard

A browser-based **operations dashboard** for analyzing CCTV / logistics-style issue data from **CSV files**. The UI runs **in the browser**; analytics are computed client-side. **Optional [Supabase](https://supabase.com)** stores one **shared CSV snapshot** so anyone with the deployed app (any network) sees the **latest upload** without LAN or same Wi‑Fi.

## Features

- **CSV upload** — Parse and analyze files with Papa Parse; column names are detected automatically (RCA, Hub, Zone, Manifest, Date, POC, etc.).
- **Dashboard** — KPIs, filters (All Data, Partial Bagging, LM Fraud, No Footage, Camera Issues), zone distribution (doughnut), RCA category bar chart, weekly trends, issue hotspots, hub-level charts, and a “Recent issues” table.
- **Data table** — Search, filters (zone, RCA, category), pagination, row click / button to export a single row as CSV.
- **POC productivity (POC)** — Per–point-of-contact metrics: **productivity = total eligible cases ÷ valid RCA cases** (eligible = all rows with a POC; valid RCA excludes Closed, Offline, blank RCA, and “not centralized” / “not centralised”). Optional weekly ratio trends and CSV export.
- **Dark / light theme** — Toggle in the header; preference is saved in `localStorage`.
- **Export PDF** — Captures the current screen (header + main) as a PDF via `html2pdf.js` (charts included; very long pages may need the browser **Print → Save as PDF** fallback).
- **Responsive UI** — Layout tuned for phones, tablets, and desktops (safe areas, touch-friendly controls).

## Tech stack

| Area        | Technology                          |
| ----------- | ----------------------------------- |
| UI          | React 18                            |
| Build       | Vite 6                              |
| Styling     | Tailwind CSS 3                      |
| Charts      | Chart.js 4, react-chartjs-2         |
| CSV         | Papa Parse                          |
| PDF         | html2pdf.js (html2canvas + jsPDF)   |
| Cloud (opt.)| Supabase (`dashboard_snapshot` row) |

## Prerequisites

- **Node.js** 18+ recommended (for Vite 6)

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Shared data (Supabase, optional)

To sync one CSV across **all users** over the internet:

1. Create a Supabase project and open **SQL Editor**.
2. Run the script in **`supabase/schema.sql`** (table `dashboard_snapshot`, row `id = 1`, RLS policies for `anon`).
3. Copy **Project URL** and **anon public** key from **Project Settings → API**.
4. In the project root, create **`.env`** (not committed; see **`.env.example`**):

   ```bash
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

5. Restart `npm run dev` or rebuild for production.

**Behavior:** On load, if env vars are set, the app **fetches** the stored CSV and parses it like a local upload. After a successful **upload**, it **upserts** the full file text so others get it on refresh.

**Security note:** The sample RLS allows **anonymous read and write** on that single row—fine for a small internal tool, but **anyone with your anon key can change the snapshot**. For production, tighten policies (e.g. signed-in users only, or Edge Functions with a secret) and rotate keys if exposed.

## Scripts

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `npm run dev`    | Start dev server with HMR      |
| `npm run build`  | Production build → `dist/`     |
| `npm run preview`| Serve the production build     |

## CSV columns

The app **auto-detects** common header names, including:

- **RCA** — `rca`, `root cause`, `category`, `issue`, etc.
- **Hub** — `hub`, `location`, `site`, `warehouse`, …
- **Zone** — `zone`, `region`, `area`
- **Manifest** — `manifest`, `awb`, `shipment id`, …
- **Date** — `date`, `created`, `reported`, `timestamp`, … (for weekly trends)
- **POC** — `poc`, `point of contact`, `owner`, `assignee`, …
- **Open**, **CCTV** — optional, when present

If no RCA column is found, the **first column** is used for classification (with a warning).

## Sample data

A small example file is included at **`public/sample-issues.csv`** (includes POC column for testing productivity).

## Deployment

After `npm run build`, deploy the **`dist/`** folder to any static host (Netlify, Vercel, S3 + CloudFront, GitHub Pages, etc.). Configure the host to serve `index.html` for SPA routes if you add client-side routing later.

## License

Private project (`"private": true` in `package.json`). Adjust as needed for your org.
