/**
 * Language list for printing-frame content, built from Intl.DisplayNames —
 * no external API or hand-maintained list. ISO 639-1 codes cover the
 * standard set of languages any runtime already knows the names of.
 */
const ISO_639_1_CODES = [
  "en", "hi", "bn", "te", "mr", "ta", "ur", "gu", "kn", "ml",
  "pa", "or", "as", "mai", "sat", "ks", "ne", "sd", "kok", "doi",
  "mni", "brx", "sa",
  "fr", "de", "es", "pt", "ar", "zh", "ja", "ru",
] as const;

export type LanguageOption = { code: string; name: string };

/** Sorted by display name, English first (the default). */
export function getLanguageOptions(locale = "en"): LanguageOption[] {
  const dn = new Intl.DisplayNames([locale], { type: "language" });
  const seen = new Set<string>();
  const options: LanguageOption[] = [];

  for (const code of ISO_639_1_CODES) {
    if (seen.has(code)) continue;
    seen.add(code);
    let name: string;
    try {
      name = dn.of(code) ?? code;
    } catch {
      name = code;
    }
    options.push({ code, name });
  }

  options.sort((a, b) => {
    if (a.code === "en") return -1;
    if (b.code === "en") return 1;
    return a.name.localeCompare(b.name);
  });

  return options;
}
