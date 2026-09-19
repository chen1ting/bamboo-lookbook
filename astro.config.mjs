import { defineConfig } from "astro/config";

import { languages, defaultLang } from "./src/i18n/utils";

// Static output, built-in i18n. The locale list lives in src/i18n/utils.ts
// (single source of truth), so adding a language there is enough.
// Every locale is prefixed, including the default: /en/..., /zh/..., /it/...
export default defineConfig({
  site: "https://lookbook.example.com",
  output: "static",
  // The upload script writes mock-cdn assets here; `npm run dev` also needs the
  // directory to exist (git only tracks .gitkeep).
  publicDir: "./public",
  i18n: {
    defaultLocale: defaultLang,
    locales: Object.keys(languages),
    routing: {
      prefixDefaultLocale: true,
      // src/pages/index.astro sends "/" to the default locale.
      redirectToDefaultLocale: false,
    },
  },
});
