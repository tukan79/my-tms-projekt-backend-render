/**
 * Sprawdza, czy dany kod pocztowy należy do strefy na podstawie zdefiniowanych wzorców.
 * @param {string | undefined | null} postcode - Kod pocztowy do sprawdzenia.
 * @param {object | undefined | null} zone - Obiekt strefy z polem `postcode_patterns`.
 * @returns {boolean} - Zwraca `true`, jeśli kod pocztowy pasuje do któregokolwiek wzorca.
 */
export const isPostcodeInZone = (postcode, zone) => {
  if (!postcode || !zone?.postcode_patterns?.length) {
    return false;
  }

  // Poprawka: Normalizujemy kod pocztowy, ale zachowujemy jego strukturę.
  // Bierzemy tylko część "outward" kodu pocztowego (przed spacją).
  // Fix: Normalize the postcode but preserve its structure.
  // Take only the "outward" part of the postcode (before the space).
  const postcodeOutward = postcode.split(' ')[0].toUpperCase();

  return zone.postcode_patterns.some(pattern => {
    const normalizedPattern = pattern.replace(/\s/g, '').toUpperCase();

    // Usuwamy '%' ze wzorca, aby uzyskać czysty prefix do porównania.
    // Remove '%' from the pattern to get a clean prefix for comparison.
    const prefix = normalizedPattern.endsWith('%')
      ? normalizedPattern.slice(0, -1)
      : normalizedPattern;

    return postcodeOutward.startsWith(prefix);
  });
};