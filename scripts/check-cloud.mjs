/**
 * Verifies Firebase env vars for the cloud snapshot (same keys as Vite).
 * Usage: npm run check:cloud
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

const keys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing = keys.filter((k) => !process.env[k]?.trim());

if (missing.length) {
  console.error(
    "Missing Firebase env vars:\n  " +
      missing.join("\n  ") +
      "\n\nCreate .env from .env.example, then run again."
  );
  process.exit(1);
}

console.log("Firebase config env vars OK for cloud snapshot.");
console.log("Next: deploy firestore.rules (see repo), then open the app. Authentication is optional with current rules.");
