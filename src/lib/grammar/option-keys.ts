/**
 * Maps an a/b/c… keypress to an option index for letter-labelled questions.
 * Returns -1 when the key should be ignored.
 *
 * Single-key shortcuts are only active while focus is inside the question box
 * (marked with `data-grammar-question` in GrammarSession), never on the whole
 * page (WCAG 2.1.4). Modifier combos, auto-repeat, already-handled keys and
 * typing in fields are ignored so browser shortcuts and inputs keep working.
 */
export function optionKeyIndex(e: KeyboardEvent, count: number): number {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return -1;
  const target = e.target as HTMLElement | null;
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return -1;
  if (!target?.closest('[data-grammar-question]')) return -1;
  if (e.key.length !== 1) return -1;
  const index = e.key.toLowerCase().charCodeAt(0) - 97;
  return index >= 0 && index < count ? index : -1;
}
