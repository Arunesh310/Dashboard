/**
 * Verifies Supabase env vars and that `dashboard_snapshot` is reachable.
 * Usage from repo root:
 *   node scripts/check-cloud.mjs
 * Expects `.env` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (same as the app).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.\n" +
      "Create a .env file (see .env.example) in the project root, then run again."
  );
  process.exit(1);
}

const rest = `${url}/rest/v1/dashboard_snapshot?id=eq.1&select=id,file_name,updated_at,camera_file_name,camera_updated_at`;

const res = await fetch(rest, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  },
});

if (!res.ok) {
  const text = await res.text();
  console.error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  if (res.status === 400 && /camera_file_name|column|schema cache/i.test(text)) {
    console.error(
      "\n→ Camera columns missing. Run supabase/migration_add_camera_columns.sql in the SQL Editor,\n  or: npm run migrate:camera (with DATABASE_URL in .env)"
    );
  } else {
    console.error(
      "\n→ In Supabase: run supabase/schema.sql in the SQL Editor, then try again."
    );
  }
  process.exit(1);
}

const rows = await res.json();
console.log("Supabase OK — dashboard_snapshot is reachable.");
if (Array.isArray(rows) && rows[0]) {
  console.log("Row:", JSON.stringify(rows[0], null, 2));
} else {
  console.log("No row yet (empty snapshot). Upload a CSV in the app once to populate.");
}
