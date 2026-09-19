import en from "./en.json";
import it from "./it.json";
import zh from "./zh.json";

// The locale registry: `label` is what the nav switcher prints, `htmlLang` feeds <html lang>.
// Add a language here + drop in src/i18n/<code>.json — every page picks it up.
export const languages = {
  en: { label: "EN", htmlLang: "en" },
  zh: { label: "中", htmlLang: "zh-Hans" },
  it: { label: "IT", htmlLang: "it" },
} as const;

export type Lang = keyof typeof languages;
export const locales = Object.keys(languages) as Lang[];
export const defaultLang: Lang = "en";

const dict: Record<Lang, Record<string, string>> = { en, zh, it };

/** Returns a translator bound to a locale. Falls back to en, then to the key itself. */
export function t(lang: Lang) {
  return (key: string): string => dict[lang]?.[key] ?? dict[defaultLang][key] ?? key;
}

/**
 * A per-locale value, e.g. `{ en: "…", zh: "…", it: "…" }`.
 * Missing locales fall back to the default, so partial translations still render.
 */
export type Localized<T = string> = Partial<Record<Lang, T>>;

export function pick<T>(value: Localized<T> | undefined, lang: Lang): T | undefined {
  return value?.[lang] ?? value?.[defaultLang];
}

/** Resolve the locale from a static-path / current URL. */
export function getLangFromUrl(url: URL): Lang {
  const seg = url.pathname.split("/")[1];
  return locales.includes(seg as Lang) ? (seg as Lang) : defaultLang;
}

/** Locale-aware link. Every locale is prefixed, the default one included. */
export function localizedPath(lang: Lang, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${lang}/` : `/${lang}${clean}`;
}

/** Strip the locale prefix off a pathname so it can be re-localized. */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(new RegExp(`^/(${locales.join("|")})(?=/|$)`), "");
  return stripped === "" ? "/" : stripped;
}
