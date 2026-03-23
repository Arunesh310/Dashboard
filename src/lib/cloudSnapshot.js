import { getSupabase } from "./supabaseClient.js";

const TABLE = "dashboard_snapshot";
const ROW_ID = 1;

/**
 * @returns {Promise<{ csv_text: string; file_name: string; updated_at: string } | null>}
 */
export async function loadSnapshot() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("csv_text, file_name, updated_at")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message || "Supabase read failed");
  if (!data?.csv_text?.trim()) return null;
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
