/**
 * Applies supabase/migration_add_camera_columns.sql using a direct Postgres connection.
 *
 * Setup (one time):
 *   Supabase → Project Settings → Database → Connection string → URI
 *   Copy into .env as DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@...
 *
 * Then: npm run migrate:camera
 *
 * If DATABASE_URL is not set, prints the SQL to paste into SQL Editor instead.
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

const migrationPath = path.join(__dirname, "..", "supabase", "migration_add_camera_columns.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!dbUrl) {
  console.log("No DATABASE_URL in .env — paste the following into Supabase → SQL Editor → Run:\n");
  console.log("—".repeat(60));
  console.log(sql.trim());
  console.log("—".repeat(60));
  console.log(
    "\nOr add DATABASE_URL (Postgres URI from Supabase → Settings → Database) to .env and run:\n  npm run migrate:camera\n"
  );
  process.exit(0);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("OK — camera columns applied on dashboard_snapshot.");
} catch (e) {
  console.error(e.message || e);
  if (String(e.message || "").includes("already exists") || String(e.code) === "42701") {
    console.log("(Column may already exist — safe to ignore if Camera Status sync works.)");
    process.exit(0);
  }
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
