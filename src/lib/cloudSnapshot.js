import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreDb } from "./firebaseClient.js";

const COLLECTION = "dashboard_snapshot";
const DOC_ID = "shared";
const CHUNKS_COLLECTION = "dashboard_snapshot_chunks";
const MAX_INLINE_BYTES = 900_000;
const encoder = new TextEncoder();

function byteLength(text) {
  return encoder.encode(text || "").length;
}

function splitByByteLength(text, maxBytes) {
  const value = String(text || "");
  if (!value.length) return [""];
  const chunks = [];
  let start = 0;

  while (start < value.length) {
    let low = start + 1;
    let high = value.length;
    let best = start + 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const part = value.slice(start, mid);
      if (byteLength(part) <= maxBytes) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    chunks.push(value.slice(start, best));
    start = best;
  }

  return chunks;
}

function chunkDocId(kind, index) {
  return `${DOC_ID}_${kind}_${index}`;
}

async function readChunkedText(db, kind, count) {
  if (!count || count < 1) return "";
  const reads = [];
  for (let i = 0; i < count; i += 1) {
    reads.push(getDoc(doc(db, CHUNKS_COLLECTION, chunkDocId(kind, i))));
  }
  const docs = await Promise.all(reads);
  return docs.map((s) => (s.exists() && typeof s.data().text === "string" ? s.data().text : "")).join("");
}

async function writeChunkedText(db, kind, text, previousCount) {
  const chunks = splitByByteLength(text, MAX_INLINE_BYTES);
  const writes = chunks.map((chunk, i) =>
    setDoc(doc(db, CHUNKS_COLLECTION, chunkDocId(kind, i)), {
      text: chunk,
      index: i,
      kind,
      root_id: DOC_ID,
      updated_at: new Date().toISOString(),
    })
  );

  const staleDeletes = [];
  for (let i = chunks.length; i < (previousCount || 0); i += 1) {
    staleDeletes.push(deleteDoc(doc(db, CHUNKS_COLLECTION, chunkDocId(kind, i))));
  }

  await Promise.all([...writes, ...staleDeletes]);
  return chunks.length;
}

/**
 * @returns {Promise<{
 *   csv_text: string;
 *   file_name: string;
 *   updated_at: string;
 *   camera_csv_text?: string | null;
 *   camera_file_name?: string | null;
 *   camera_updated_at?: string | null;
 * } | null>}
 */
export async function loadSnapshot() {
  const db = getFirestoreDb();
  if (!db) return null;

  const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
  if (!snap.exists()) return null;

  const data = snap.data();
  let csv_text = typeof data.csv_text === "string" ? data.csv_text : "";
  if (!csv_text && Number.isInteger(data.csv_chunk_count) && data.csv_chunk_count > 0) {
    csv_text = await readChunkedText(db, "main", data.csv_chunk_count);
  }

  let camera_csv_text = typeof data.camera_csv_text === "string" ? data.camera_csv_text : null;
  if (
    !camera_csv_text &&
    Number.isInteger(data.camera_csv_chunk_count) &&
    data.camera_csv_chunk_count > 0
  ) {
    camera_csv_text = await readChunkedText(db, "camera", data.camera_csv_chunk_count);
  }

  const hasMain = Boolean(csv_text.trim());
  const hasCamera = typeof camera_csv_text === "string" && Boolean(camera_csv_text.trim());
  if (!hasMain && !hasCamera) return null;

  return {
    csv_text,
    file_name: typeof data.file_name === "string" ? data.file_name : "upload.csv",
    updated_at:
      typeof data.updated_at === "string"
        ? data.updated_at
        : data.updated_at?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
    camera_csv_text: camera_csv_text ?? null,
    camera_file_name: typeof data.camera_file_name === "string" ? data.camera_file_name : null,
    camera_updated_at:
      typeof data.camera_updated_at === "string"
        ? data.camera_updated_at
        : data.camera_updated_at?.toDate?.()?.toISOString?.() ?? null,
  };
}

/**
 * Upserts the shared CSV so all clients see the same file after refresh.
 * @param {string} csvText
 * @param {string} fileName
 */
export async function saveSnapshot(csvText, fileName) {
  const db = getFirestoreDb();
  if (!db) return;
  const rootRef = doc(db, COLLECTION, DOC_ID);
  const current = await getDoc(rootRef);
  const prevCount = current.exists() ? Number(current.data().csv_chunk_count || 0) : 0;
  const updatedAt = new Date().toISOString();

  if (byteLength(csvText) <= MAX_INLINE_BYTES) {
    // Small payload: keep in the root document for fastest reads.
    await setDoc(
      rootRef,
      {
        csv_text: csvText,
        csv_chunk_count: 0,
        file_name: fileName || "upload.csv",
        updated_at: updatedAt,
      },
      { merge: true }
    );
    if (prevCount > 0) {
      const staleDeletes = [];
      for (let i = 0; i < prevCount; i += 1) {
        staleDeletes.push(deleteDoc(doc(db, CHUNKS_COLLECTION, chunkDocId("main", i))));
      }
      await Promise.all(staleDeletes);
    }
    return;
  }

  const chunkCount = await writeChunkedText(db, "main", csvText, prevCount);
  await setDoc(
    rootRef,
    {
      csv_text: "",
      csv_chunk_count: chunkCount,
      file_name: fileName || "upload.csv",
      updated_at: updatedAt,
    },
    { merge: true }
  );
}

/**
 * Updates only Camera Status fields (does not clear dashboard CSV).
 * @param {string} csvText
 * @param {string} fileName
 */
export async function saveCameraSnapshot(csvText, fileName) {
  const db = getFirestoreDb();
  if (!db) return;
  const rootRef = doc(db, COLLECTION, DOC_ID);
  const current = await getDoc(rootRef);
  const prevCount = current.exists() ? Number(current.data().camera_csv_chunk_count || 0) : 0;
  const updatedAt = new Date().toISOString();

  if (byteLength(csvText) <= MAX_INLINE_BYTES) {
    await setDoc(
      rootRef,
      {
        camera_csv_text: csvText,
        camera_csv_chunk_count: 0,
        camera_file_name: fileName || "camera-status.csv",
        camera_updated_at: updatedAt,
      },
      { merge: true }
    );
    if (prevCount > 0) {
      const staleDeletes = [];
      for (let i = 0; i < prevCount; i += 1) {
        staleDeletes.push(deleteDoc(doc(db, CHUNKS_COLLECTION, chunkDocId("camera", i))));
      }
      await Promise.all(staleDeletes);
    }
    return;
  }

  const chunkCount = await writeChunkedText(db, "camera", csvText, prevCount);
  await setDoc(
    rootRef,
    {
      camera_csv_text: "",
      camera_csv_chunk_count: chunkCount,
      camera_file_name: fileName || "camera-status.csv",
      camera_updated_at: updatedAt,
    },
    { merge: true }
  );
}
