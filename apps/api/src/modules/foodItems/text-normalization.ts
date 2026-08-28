/**
 * Canonical Unicode normalization for food identity and retrieval text.
 *
 * Keep this deliberately narrower than full internationalization: the
 * selected reference datasets require deterministic diacritic and ligature
 * handling while the existing lexical/token rules remain separate.
 */
export function normalizeFoodIdentityText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
