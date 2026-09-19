# Bamboo Lookbook · 竹 · 服装外贸展示站

An editorial, bamboo-themed multilingual (EN / 中文 / IT) lookbook built with **Astro** (static output) + **TypeScript**.
极简东方风格的服装外贸展示站，支持中英意三语，Astro 静态输出 + TypeScript。

Design references: vertical "bamboo culm" rules between cards, generous whitespace, paper-white background,
deep bamboo-green accents. Imagery lives on **Cloudflare R2**; the repository only stores JSON manifests.

## Quick start · 快速开始

```bash
npm install
npm run dev          # http://localhost:4321
```

Demo content is already included (`src/content/galleries/*.json`) using `placehold.co` URLs, so the site
renders immediately. 示例数据使用占位图，`npm run dev` 即可看到完整效果。

Requires **Node ≥ 20.19** (Astro 5). Windows note: if `npm` runs but `node.exe` is "not recognized",
the npm shim and `node.exe` are coming from different installs — make sure the directory containing
`node.exe` is on `PATH` and is the **first** node entry, then open a new terminal.
Windows 提示：若 `npm` 能跑但报 `node.exe` 找不到，说明 npm 与 node.exe 来自两次不同的安装，
把含 `node.exe` 的目录放在 `PATH` 最前面并重开终端即可。

## URLs · 路由

Every locale is prefixed, the default one included — one URL shape for all three.

| Page              | English (default)         | 中文                      | Italiano                  |
| ----------------- | ------------------------- | ------------------------- | ------------------------- |
| Lookbook overview | `/en/` and `/en/lookbook` | `/zh/` and `/zh/lookbook` | `/it/` and `/it/lookbook` |
| Season detail     | `/en/collection/<season>` | `/zh/collection/<season>` | `/it/collection/<season>` |
| Our Process       | `/en/process`             | `/zh/process`             | `/it/process`             |
| About Us          | `/en/about`               | `/zh/about`               | `/it/about`               |
| Contact Us        | `/en/contact`             | `/zh/contact`             | `/it/contact`             |

`/` is the only un-prefixed URL and 301s to `/en/`. Everything else is always prefixed, so
`/lookbook` and `/collection/<season>` do **not** exist — there is exactly one URL per page.

`en` is only the _default_ locale, used for `t()` fallbacks and the `/` redirect.
语言切换器会保留当前页面路径，默认语言同样带前缀。

## How to …

### Add a season

```bash
# 1. drop the photos in
mkdir raw-images/2026-resort && cp ~/shoot/*.jpg raw-images/2026-resort/

# 2. compress + generate the manifest (no R2 needed)
node scripts/uploadPhoto.js 2026-resort --dry-run \
     --label-en "Resort '26" --label-zh "2026 度假系列" --label-it "Resort '26"

# 3. see it
npm run dev            # → /en/lookbook
```

The new season is picked up automatically: the list sorts by `date`, the newest entry is
badged **NOW AVAILABLE** and the rest **ARCHIVE**. No code change needed.

### Fill in a translation later

Season JSONs accept partial locales — anything missing falls back to `en`:

```json
"seasonLabel": { "en": "Spring Summer '26" }
```

Add the other keys whenever the translation lands; the site keeps building meanwhile.
季度 JSON 可以先只写英文，缺失语种自动回退，之后再补翻译即可。

### Rename a season slug

Rename `src/content/galleries/<old>.json` and its `season` field, then update any links.
The folder under `raw-images/` and the R2 prefix are just conventions — nothing joins on them.

### Change the badge text

Badges are i18n keys, not content: edit `home.tagNow` / `home.tagArchive` in `src/i18n/*.json`.
Per-season `tag` values in the JSON are optional overrides that the UI does not read yet.

### Add a new page

Create `src/pages/[lang]/your-page.astro` and copy the two-line header from
`src/pages/[lang]/lookbook.astro`:

```astro
---
import Layout from '../../layouts/Layout.astro';
import { langPaths } from '../../lib/routes';

export const getStaticPaths = () => langPaths();
---

<Layout lang={Astro.props.lang as Lang}>…</Layout>
```

`langPaths()` already emits every locale, so the page appears in all three at once.
新增页面只要套用这两行 `getStaticPaths`，三种语言会同时生成。

### Set the real contact details
All of it lives in **one file** — `src/lib/site.ts`:

```ts
export const site = {
  email: 'hello@example.com',
  phone: '+86 000 0000 0000',
  whatsapp: 'https://wa.me/860000',
};

export const socials = [
  { key: 'instagram', label: 'Instagram', handle: '@bamboo.studio', url: 'https://instagram.com/' },
  // wechat · linkedin · pinterest · youtube · tiktok …
];
```

The `key` picks the glyph in `SocialIcon.astro`; add an entry to the `paths` map there for a
new network. Every page links to Contact, so there is nothing else to update.
联系方式与社媒占位链接全部集中在 `src/lib/site.ts`：改这里即可，无需动其他文件。
新增社媒平台时，同时在 `SocialIcon.astro` 的 `paths` 里加一行图标路径。

### Deploy
`npm run build` writes a static `dist/` — host it anywhere (Netlify, S3, Cloudflare Pages).
Point `site` in `astro.config.mjs` at your real domain and set the R2 public base URL in `.env`.
Images stay on R2; the repo ships only the JSON manifests.

Because output is `static`, pretty URLs come from directory indexes — make sure your host does
not require a rewrite rule for `/en/lookbook/` (trailing slash).

#### Cloudflare (Workers static assets)

The repo ships a `wrangler.jsonc`, so deploying is one command — and the build command in the
Cloudflare dashboard must be `npm run build` (not `npm run deploy`, which is for local use):

```bash
npm run deploy          # = npm run build && wrangler deploy
```

`wrangler.jsonc` declares `assets.directory: "dist"` and **no `main` entrypoint**. That is
intentional: `output` is `static`, so there is no `dist/_worker.js`, and a `main` field would make
Wrangler look for one and fail. The upload-scripts note: `wrangler deploy` re-runs the interactive
"detected framework settings" wizard only when it *cannot* find a config file — keeping
`wrangler.jsonc` committed is what stops it from re-running `astro add cloudflare` on every deploy
and erroring on the missing `public/.assetsignore`.

Also committed for that reason:

- `public/.assetsignore` — the asset uploader to skip `_worker.js`; harmless for a
  static-only build but required by Cloudflare's Astro integration.
- `public/.gitkeep` — keeps the otherwise-empty `public/` in git. Without it, `public/` does not
exist in a fresh clone and the Cloudflare setup step has nowhere to write `.assetsignore`.

Other commands:

```bash
npm run cf-preview      # wrangler dev — serves dist/ exactly as Cloudflare will
npm run cf-typegen      # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

The CLI needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in CI, or a prior
`npx wrangler login` locally. 部署只需 `npm run deploy`；配置固定写在 `wrangler.jsonc`，
避免 wrangler 每次都重新跑交互式设置。`public/` 必须被 git 跟踪，否则构建机上不存在该目录。

## Adding a language · 新增语言

One place to edit: `src/i18n/utils.ts`.

```ts
export const languages = {
  en: { label: "EN", htmlLang: "en" },
  zh: { label: "中", htmlLang: "zh-Hans" },
  it: { label: "IT", htmlLang: "it" },
  fr: { label: "FR", htmlLang: "fr" }, // ← new
} as const;
```

1. add the entry above and drop in `src/i18n/fr.json`;
2. that is it — routing, the nav switcher, `<html lang>`, and the content schema all
   derive from this registry. Missing `seasonLabel`/`tag` values fall back to `en`,
   so existing season JSONs keep working until you translate them.

只需修改 `src/i18n/utils.ts` 一处，加上 `src/i18n/<code>.json` 即可：路由、导航语言切换、
`<html lang>`、内容 schema 全部自动派生，旧的季度 JSON 缺字段时会回退到英文。

## Content model · 数据结构

One JSON per season in `src/content/galleries/`, validated by the schema in `src/content.config.ts`:

```json
{
  "season": "2026-spring-summer",
  "date": "2026-03-01",
  "seasonLabel": { "en": "Spring Summer '26", "zh": "2026 春夏", "it": "Primavera Estate '26" },
  "tag": { "en": "NOW AVAILABLE", "zh": "现已上市", "it": "DISPONIBILE ORA" },
  "coverImage": "https://img.yourdomain.com/2026-spring/cover.webp",
  "images": [{ "url": "https://img.yourdomain.com/2026-spring/001.webp", "alt": "look 1" }]
}
```

Seasons are listed newest-first. The newest one is badged **NOW AVAILABLE**, the rest **ARCHIVE**
(badges come from `src/i18n/*.json`, not from the JSON files).

## Text / i18n · 多语言文案

Keys live in `src/i18n/<locale>.json` (`en`, `zh`, `it`); pages call `t(lang)('key')`.
Never hard-code copy in a page. 文案统一走 i18n，页面里不硬编码文字。

## Photo pipeline · 图片上传脚本

```bash
# 1. put originals here:  ./raw-images/<season>/    (jpg / png / webp / tiff / avif)
# 2. dry-run: no R2 needed, writes ./public/mock-cdn/<season>/ and rewrites the JSON
node scripts/uploadPhoto.js 2026-spring-summer --dry-run

# 3. real upload to Cloudflare R2
cp .env.example .env      # then fill in the R2_* values
node scripts/uploadPhoto.js 2026-spring-summer \
     --label-en "Spring Summer '26" --label-zh "2026 春夏" --label-it "Primavera Estate '26" \
     --date 2026-03-01
```

What it does / 脚本行为:

1. reads every supported image in `./raw-images/<season>/`, sorted naturally;
2. `sharp`: rotates by EXIF, resizes to max width **1600px** (never upscales), converts to **webp q80**;
3. publishes — dry-run into `public/mock-cdn/<season>/`, otherwise `PutObjectCommand` to R2;
4. regenerates `src/content/galleries/<season>.json` with the **first image as `coverImage`**;
5. prints clear errors for a missing folder, unsupported formats and failed uploads.

Options: `--dry-run`, `--label-<locale>`, `--tag-<locale>`, `--date`, `--help`.
The script reads the locale list straight out of `src/i18n/utils.ts`, so a new language
immediately gains a matching `--label-<code>` / `--tag-<code>` flag.
脚本从 `src/i18n/utils.ts` 读取语言列表，新增语言后会自动多出对应的命令行参数。

## Components · 组件

- `src/components/SeasonView.astro` — the single season detail view (title, grid, lightbox).
One view component per page, and a ~9-line route file that mounts it:

- `src/components/LookbookList.astro` — the season card list (used by `/` and `/lookbook`).
- `src/components/SeasonView.astro` — season detail: title, grid, lightbox.
- `src/components/ProcessView.astro` — the numbered five-step process, threaded on a bamboo culm.
- `src/components/AboutView.astro` — prose + capability list.
- `src/components/ContactView.astro` — contact details + social placeholder links.
- `src/components/PhotoGrid.astro` — responsive 1–4 column gallery, lazy images, `data-pswp-*` for the lightbox.
- `src/components/Lightbox.astro` — wires **PhotoSwipe v5** (swipe, zoom, keyboard) onto every grid.
- `src/components/Nav.astro` — sticky transparent header, language switcher, mobile hamburger.
- `src/components/BambooIcon.astro` / `SocialIcon.astro` — the only SVGs: 4 bamboo strokes, one glyph per network.
- `src/lib/routes.ts` — the shared `getStaticPaths` helper, so every route file is ~9 lines.
- `src/lib/site.ts` — contact details and social links (edit this, not the components).

Page transitions use Astro's `<ClientRouter />` with a 0.55s fade + slight vertical drift (see `global.css`).

## Theme tokens · 视觉变量

`#4A5D45` deep bamboo · `#8B9D83` light bamboo · `#F7F5F0` paper · `#2B2B26` ink.
Type: **Playfair Display** (EN) + **Noto Serif SC** (中文), headings at `letter-spacing: 0.05em`.
