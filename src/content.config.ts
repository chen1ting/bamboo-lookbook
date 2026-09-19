import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { languages } from "./i18n/utils";

// Built from the locale registry, so a new language needs no schema change.
// Every locale stays optional and falls back to `en` at render time.
const localized = z.object(
  Object.fromEntries(Object.keys(languages).map((code) => [code, z.string().optional()])),
);

// One JSON file per season, e.g. src/content/galleries/2026-spring-summer.json
const galleries = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/galleries" }),
  schema: z.object({
    season: z.string(),
    date: z.coerce.date(),
    seasonLabel: localized,
    tag: localized.optional(),
    coverImage: z.string(),
    images: z.array(
      z.object({
        url: z.string(),
        alt: z.string().default(""),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
    ),
  }),
});

export const collections = { galleries };
