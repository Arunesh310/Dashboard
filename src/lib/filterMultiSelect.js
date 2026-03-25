/**
 * Multi-select filter semantics:
 * - Empty selection OR every option selected ⇒ "all" (stored as []).
 * - Otherwise ⇒ sorted list of chosen option values.
 */
export function normalizeMultiSelect(selection, allOptions) {
  const opts = [...new Set(allOptions)].filter((o) => o != null);
  if (opts.length === 0) return [];
  const set = new Set(Array.isArray(selection) ? selection : []);
  if (set.size === 0) return [];
  const allPicked = opts.every((o) => set.has(o));
  if (allPicked) return [];
  return opts.filter((o) => set.has(o)).sort((a, b) => String(a).localeCompare(String(b)));
}

/** True when both selections normalize to the same committed filter. */
export function sameNormalizedSelection(a, b, allOptions) {
  const na = normalizeMultiSelect(a, allOptions);
  const nb = normalizeMultiSelect(b, allOptions);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    if (na[i] !== nb[i]) return false;
  }
  return true;
}
