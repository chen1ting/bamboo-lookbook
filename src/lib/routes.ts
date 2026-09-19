import { getCollection } from "astro:content";
import { locales, type Lang } from "../i18n/utils";

const seasons = (await getCollection("galleries")).map((entry) => entry.data.season);
const propsFor = (lang: Lang) => ({ props: { lang } });

/**
 * Static paths for a `[lang]` route: every locale, always prefixed (the default one
 * included, so /en/... exists as well). Pass `true` for [lang]/collection/[season].
 */
export function langPaths(withSeason = false) {
  return locales.flatMap((lang) =>
    withSeason
      ? seasons.map((season) => ({ params: { lang, season }, ...propsFor(lang) }))
      : [{ params: { lang }, ...propsFor(lang) }],
  );
}
