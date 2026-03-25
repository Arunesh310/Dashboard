import { useEffect, useMemo } from "react";

/**
 * Theme-aligned multi-select: button trigger + checkbox list (details/summary).
 * @param {{ label: string, options: string[], selected: string[], setSelected: (v: string[]) => void, formatLabel?: (opt: string) => string }} props
 */
export function MultiSelectDropdownFilter({ label, options, selected, setSelected, formatLabel }) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedCount = selected.length;
  const triggerText = selectedCount ? `${selectedCount} selected` : "All";
  const show = (opt) => (formatLabel ? formatLabel(opt) : opt);

  useEffect(() => {
    const closeOpenDropdowns = () => {
      document
        .querySelectorAll("details.filter-dropdown[open]")
        .forEach((el) => el.removeAttribute("open"));
    };
    const onPointerDown = (event) => {
      const target = event.target;
      document.querySelectorAll("details.filter-dropdown[open]").forEach((el) => {
        if (!(target instanceof Node) || !el.contains(target)) {
          el.removeAttribute("open");
        }
      });
    };
    const onEscape = (event) => {
      if (event.key === "Escape") closeOpenDropdowns();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <details className="filter-dropdown group h-full">
      <summary className="filter-dropdown-summary">
        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{triggerText}</span>
        <svg
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ease-sfx-smooth group-open:rotate-180 dark:text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="filter-dropdown-panel">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/85 bg-slate-50/80 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {label}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setSelected([]);
            }}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-sfx transition-colors hover:bg-sfx-soft/80 hover:text-sfx-deep dark:text-sfx-cta dark:hover:bg-slate-700/80 dark:hover:text-sfx-cream"
          >
            Clear
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto overscroll-contain">
          {options.length ? (
            options.map((opt) => (
              <label key={opt} className="filter-dropdown-option">
                <input
                  type="checkbox"
                  checked={selectedSet.has(opt)}
                  onChange={(e) => {
                    if (e.target.checked) setSelected([...selected, opt]);
                    else setSelected(selected.filter((v) => v !== opt));
                  }}
                />
                <span className="min-w-0 flex-1 leading-snug">
                  {(() => {
                    const t = show(opt);
                    return t.length > 80 ? `${t.slice(0, 78)}…` : t;
                  })()}
                </span>
              </label>
            ))
          ) : (
            <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">No options available.</p>
          )}
        </div>
      </div>
    </details>
  );
}
