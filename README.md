# Operations CCTV Dashboard

A browser-based **operations dashboard** for analyzing CCTV / logistics-style issue data from **CSV files**. The UI runs **in the browser**; analytics are computed client-side. **Optional [Firebase / Firestore](https://firebase.google.com/docs/firestore)** stores one **shared CSV snapshot** so anyone with the deployed app (any network) sees the **latest upload** without LAN or same Wi‑Fi.

## Features

- **CSV upload** — Parse and analyze files with Papa Parse; column names are detected automatically (RCA, Hub, Zone, Manifest, Date, POC, etc.).
- **Dashboard** — KPIs, filters (All Data, Partial Bagging, LM Fraud, No Footage, Camera Issues), zone distribution (doughnut), RCA category bar chart, weekly trends, issue hotspots, hub-level charts, and a “Recent issues” table. Rows whose RCA is classified as **closed** are **omitted everywhere** (not shown in charts, tables, or exports).
- **Data table** — Search, filters (zone, RCA, category), pagination, row click / button to export a single row as CSV.
- **POC productivity (POC)** — Per–point-of-contact metrics: **productivity = (valid RCA ÷ eligible) × 100** as a percentage (eligible = rows with a POC among non-closed data; valid RCA excludes Offline, blank RCA, and “not centralized” / “not centralised”). Optional weekly trends and CSV export (`productivity_pct`).
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
| Cloud (opt.)| Firestore (`dashboard_snapshot/shared` document) |

## Prerequisites

- **Node.js** 18+ recommended (for Vite 6)

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Shared data (Firebase / Firestore, optional)

To sync one CSV across **all users** over the internet:

1. Create a Firebase project, enable **Firestore**, and add a **Web app** to get the config object.
2. Enable **Authentication → Sign-in method → Google**. (Email/Password is optional; the app sign-in UI is **Google only**.) Under **Authentication → Settings → Authorized domains**, add your production host (e.g. `your-app.vercel.app`).
3. Deploy **`firestore.rules`** (CLI: `firebase deploy --only firestore:rules`, or paste in **Firestore → Rules**). The bundled rules allow **only signed-in users** whose email matches **`@shadowfax.in`** (case-insensitive) to read/write `dashboard_snapshot` and `dashboard_snapshot_chunks`.
4. In the project root, create **`.env`** from **`.env.example`**: set all `VITE_FIREBASE_*` values; for production, set **`VITE_SHADOWFAX_AUTH=true`** so the app shows a sign-in screen and accepts only `@shadowfax.in` addresses.
5. Restart `npm run dev` or rebuild for production.

**Behavior:** On load, if env vars are set, the app **reads** document `dashboard_snapshot/shared` and parses CSV fields like a local upload. After upload, it **merges** the snapshot so others see it on refresh. Camera Status CSV uses the same document with separate fields.

**Security note:** Firebase **web config is public**; access control is **Firestore rules + Google sign-in**. Only `@shadowfax.in` accounts pass the app and rules. You can restrict who gets Google accounts via your Google Workspace admin; consider disabling **Email/Password** in Firebase if unused. Never put a **service account** or Admin SDK key in Vite env.

**Local dev without login:** set `VITE_SHADOWFAX_AUTH=false` and either use emulators or temporarily relax Firestore rules (not recommended for production).

## Scripts

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `npm run dev`    | Start dev server with HMR      |
| `npm run build`  | Production build → `dist/`     |
| `npm run preview`| Serve the production build     |
| `npm run mobile:sync` | Build web app + sync Android project |
| `npm run mobile:open:android` | Open Android Studio project |
| `npm run mobile:run:android` | Build web app + run on connected Android device |
| `npm run check:cloud` | Verify `VITE_FIREBASE_*` in `.env`      |
| `npm run firebase:login` | Firebase CLI login (one-time)       |
| `npm run firebase:deploy:rules` | Deploy `firestore.rules` (set `.firebaserc`) |

## Android app (personal / local use)

This project is configured with [Capacitor](https://capacitorjs.com/) and includes an `android/` native project.

### Build and open Android project

```bash
npm run mobile:sync
npm run mobile:open:android
```

Then in Android Studio:

1. Connect your Android phone (USB debugging enabled), or start an emulator.
2. Click **Run** to install and launch the app.

### Generate APK (no Play Store needed)

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
or from terminal:

```bash
cd android
./gradlew assembleDebug
```

Debug APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install this APK directly on your phone for private use.

## CSV columns

The app **auto-detects** common header names, including:

- **RCA** — `rca`, `root cause`, `category`, `issue`, etc.
- **Hub** — `hub`, `location`, `site`, `warehouse`, …
- **Zone** — `zone`, `region`, `area`
- **Manifest** — `manifest`, `awb`, `shipment id`, …
- **Date** — Weekly trends prefer **`Data uploaded date`** / **`Uploaded date`** when present; otherwise `date`, `created`, `reported`, `timestamp`, …
- **POC** — `poc`, `point of contact`, `owner`, `assignee`, …
- **Open**, **CCTV** — optional, when present

If no RCA column is found, the **first column** is used for classification (with a warning).

## Sample data

A small example file is included at **`public/sample-issues.csv`** (includes POC column for testing productivity).

## Deployment (share the link + shared CSV)

Configs in this repo: **`vercel.json`**, **`netlify.toml`** (build → `dist/`, SPA fallback).

### Option A — Vercel (fastest)

1. **[Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FArunesh310%2FDashboard)** (imports this GitHub repo).  
2. Add **Environment variables** from **`.env.example`** (`VITE_FIREBASE_*`).  
3. **Redeploy** after saving env vars (Vite bakes them in at build time).  
4. In Firebase, deploy **`firestore.rules`**.  
5. Open your Vercel URL → upload a CSV. Anyone opening that same URL loads the shared snapshot.

### Option B — Netlify

Connect the GitHub repo, set the **`VITE_FIREBASE_*`** variables under **Site configuration → Environment variables**, trigger a deploy.

### Verify Firebase env locally

After `.env` is filled:

```bash
npm run check:cloud
```

### Manual static hosting

After `npm run build`, upload **`dist/`** to any static host. Configure **`VITE_FIREBASE_*`** in that host’s build environment (or your build will have no cloud sync).

## License

Private project (`"private": true` in `package.json`). Adjust as needed for your org.
