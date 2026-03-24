/**
 * Legacy name — kept so `npm run migrate:camera` still runs.
 * Firestore is schemaless: camera CSV fields live on the same document as the dashboard snapshot (no SQL migration).
 */
console.log(
  "No migration needed — Firestore stores camera columns on document dashboard_snapshot/shared with merge updates."
);
process.exit(0);
