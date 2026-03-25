import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

const SHADOWFAX_EMAIL_SUFFIX = "@shadowfax.in";

/** Only these signed-in users may use the CSV upload control when Shadowfax auth is enforced. */
const CSV_UPLOAD_ALLOWLIST = new Set(
  [
    "arunesh.kumar@shadowfax.in",
    "trupti.pali@shadowfax.in",
    "cctv.issues@shadowfax.in",
    "mohammad.alam@shadowfax.in",
  ].map((e) => e.toLowerCase())
);

export function isCsvUploadAllowlistedEmail(email) {
  if (!email || typeof email !== "string") return false;
  return CSV_UPLOAD_ALLOWLIST.has(email.trim().toLowerCase());
}

/**
 * Manual CSV uploads (file picker). Cloud snapshot restore is separate.
 * Local dev and builds without the Shadowfax gate stay unrestricted.
 */
export function canUploadCsv(resolvedEmail) {
  if (import.meta.env.DEV) return true;
  if (!requiresShadowfaxGate()) return true;
  return isCsvUploadAllowlistedEmail(resolvedEmail);
}

/** When true, app shows sign-in and only @shadowfax.in users may use the dashboard. */
export function requiresShadowfaxGate() {
  if (import.meta.env.DEV) return false;
  return import.meta.env.VITE_SHADOWFAX_AUTH === "true";
}

export function isAllowedShadowfaxEmail(email) {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase().endsWith(SHADOWFAX_EMAIL_SUFFIX);
}

/**
 * Google can briefly omit `user.email` on the first auth tick; providerData / reload fixes it.
 * @param {import("firebase/auth").User | null} user
 */
export async function resolveAuthUserEmail(user) {
  if (!user) return null;
  let e = user.email || user.providerData?.find((p) => p.email)?.email || null;
  if (e) return e;
  try {
    await user.reload();
    e = user.email || user.providerData?.find((p) => p.email)?.email || null;
  } catch {
    /* ignore */
  }
  return e;
}

/** True when Firebase web config is present so cloud snapshot can run. */
export function isCloudSnapshotConfigured() {
  return Boolean(apiKey && authDomain && projectId && messagingSenderId && appId);
}

function webConfig() {
  return {
    apiKey,
    authDomain,
    projectId,
    messagingSenderId,
    appId,
  };
}

let app;
let auth;
let db;
let googleProvider;

/** Reused so Firebase can optimize the Google sign-in flow. */
export function getGoogleAuthProvider() {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    // Avoid `hd` here: it can break return-to-app for some browsers/setups after Google approves.
    googleProvider.setCustomParameters({ prompt: "select_account" });
  }
  return googleProvider;
}

export function getFirebaseApp() {
  if (!isCloudSnapshotConfigured()) return null;
  if (app) return app;
  if (!getApps().length) {
    app = initializeApp(webConfig());
  } else {
    app = getApps()[0];
  }
  return app;
}

/** @returns {import("firebase/auth").Auth | null} */
export function getFirebaseAuth() {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!auth) {
    // Always use getAuth in the browser: it wires the popup/redirect resolver.
    // initializeAuth({ persistence } only) breaks signInWithPopup with auth/argument-error.
    auth = getAuth(a);
  }
  return auth;
}

/** @returns {import("firebase/firestore").Firestore | null} */
export function getFirestoreDb() {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!db) db = getFirestore(a);
  return db;
}
