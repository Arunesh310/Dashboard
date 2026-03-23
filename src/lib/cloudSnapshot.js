import { getSupabase } from "./supabaseClient.js";

const TABLE = "dashboard_snapshot";
const ROW_ID = 1;

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
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "csv_text, file_name, updated_at, camera_csv_text, camera_file_name, camera_updated_at"
    )
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message || "Supabase read failed");
  if (!data) return null;
  const hasMain = Boolean(data.csv_text?.trim());
  const hasCamera = Boolean(data.camera_csv_text?.trim());
  if (!hasMain && !hasCamera) return null;
  return data;
}

/**
 * Upserts the shared CSV so all clients see the same file after refresh.
 * @param {string} csvText
 * @param {string} fileName
 */
export async function saveSnapshot(csvText, fileName) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).upsert(
    {
      id: ROW_ID,
      csv_text: csvText,
      file_name: fileName || "upload.csv",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(error.message || "Supabase save failed");
}

/**
 * Updates only Camera Status fields on the shared row (does not clear dashboard CSV).
 * @param {string} csvText
 * @param {string} fileName
 */
export async function saveCameraSnapshot(csvText, fileName) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase
    .from(TABLE)
    .update({
      camera_csv_text: csvText,
      camera_file_name: fileName || "camera-status.csv",
      camera_updated_at: new Date().toISOString(),
    })
    .eq("id", ROW_ID);

  if (error) throw new Error(error.message || "Supabase camera save failed");
}
