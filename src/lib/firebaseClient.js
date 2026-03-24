import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

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
  if (!auth) auth = getAuth(a);
  return auth;
}

/** @returns {import("firebase/firestore").Firestore | null} */
export function getFirestoreDb() {
  const a = getFirebaseApp();
  if (!a) return null;
  if (!db) db = getFirestore(a);
  return db;
}
