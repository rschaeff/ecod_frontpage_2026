/**
 * Readable chemical names from the PDB Chemical Component Dictionary.
 *
 * CCD names come in capitals, sometimes wrapped in CIF ";…;" delimiters with
 * embedded line breaks. Plain-word names are recased ("CHLORIDE ION" ->
 * "Chloride ion"); systematic names keep the dictionary's capitals, where case
 * carries meaning (N-, S-, locants).
 */
export function readableChemName(name: string | null | undefined): string | null {
  if (!name) return null;
  const s = name.replace(/^\s*;\s*|\s*;\s*$/g, '').replace(/\s*\n\s*/g, '').trim();
  if (!s) return null;
  if (s !== s.toUpperCase()) return s;
  if (/[0-9()[\]{}]/.test(s)) return s;
  const lower = s.toLowerCase();
  const i = lower.search(/[a-z]/);
  return i < 0 ? lower : lower.slice(0, i) + lower[i].toUpperCase() + lower.slice(i + 1);
}
