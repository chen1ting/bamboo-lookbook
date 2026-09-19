#!/usr/bin/env node
/**
 * uploadPhoto.js — compress a season's raw photos, publish them, then refresh
 * the season JSON that the Astro site reads.
 *
 *   node scripts/uploadPhoto.js 2026-spring-summer --dry-run
 *   node scripts/uploadPhoto.js 2026-spring-summer \
 *        --label-en "Spring Summer '26" --label-zh "2026 春夏" --date 2026-03-01
 *
 * Locales are discovered from src/i18n/utils.ts, so a new language only needs a
 * `--label-<code>` / `--tag-<code>` pair here.
 *
 * dry-run : writes webp files to ./public/mock-cdn/<season>/ and points the JSON
 *           at /mock-cdn/... so the whole pipeline renders locally without R2.
 * default : uploads to Cloudflare R2 (S3 API) using the vars in .env.
 *
 * Source images are read from ./raw-images/<season>/, sorted naturally, and the
 * first one becomes the cover.
 */
import "dotenv/config";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_ROOT = path.join(ROOT, "raw-images");
const MOCK_ROOT = path.join(ROOT, "public", "mock-cdn");
const GALLERY_DIR = path.join(ROOT, "src", "content", "galleries");
const UTILS_FILE = path.join(ROOT, "src", "i18n", "utils.ts");

// Read the locale registry out of src/i18n/utils.ts so the script never drifts
// from the site:  en: { label: "EN", htmlLang: "en" },
function readLocales() {
  let source;
  try {
    source = readFileSync(UTILS_FILE, "utf8");
  } catch {
    fail(`Cannot read ${path.relative(ROOT, UTILS_FILE)} — needed to discover the languages.`);
  }
  const block = source.match(/languages\s*=\s*{([\s\S]*?)}\s*as const/);
  const codes = block ? [...block[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]) : [];
  if (codes.length === 0) fail("No locales found in src/i18n/utils.ts — is the `languages` registry still there?");
  return codes;
}

const LOCALES = readLocales();
const defaultLocale = LOCALES[0];

const SUPPORTED = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".avif", ".gif"]);
const MAX_WIDTH = 1600;
const QUALITY = 80;

const USAGE = `
Usage: node scripts/uploadPhoto.js <season> [options]

 <season>            folder name under ./raw-images/ and the JSON file name,
                      e.g. 2026-spring-summer

Options:
  --dry-run            don't touch R2; write to ./public/mock-cdn/<season>/
  --label-<locale>     season label, one per locale (e.g. --label-en, --label-zh, --label-it)
  --tag-<locale>       badge text, one per locale (e.g. --tag-en)
  --date <date>        release date, YYYY-MM-DD (default: today)
  -h, --help           show this help
Locales (from src/i18n/utils.ts): ${LOCALES.join(", ")}
  --label-<locale> defaults to a label derived from <season> for
  "${defaultLocale}", and to an empty string elsewhere.
`;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function log(message = "") {
  console.log(message);
}

const humanSize = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function deriveLabel(season) {
  const match = season.match(/^(\d{4})-(.+)$/);
  if (!match) return season;
  const year = `'${match[1].slice(2)}`;
  const words = match[2]
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));
  return `${words.join(" ")} ${year}`;
}

// ---------- argument parsing ----------
const args = process.argv.slice(2);
const opts = { season: null, dryRun: false, date: null, label: {}, tag: {} };

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  log(USAGE);
  process.exit(0);
}

// Recognised value flags, derived from the locale list: --label-<code>, --tag-<code>.
const VALUE_FLAGS = {};
for (const code of LOCALES) {
  VALUE_FLAGS[`--label-${code}`] = ["label", code];
  VALUE_FLAGS[`--tag-${code}`] = ["tag", code];
}
VALUE_FLAGS["--date"] = ["date"];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--dry-run") {
    opts.dryRun = true;
    continue;
  }
  if (VALUE_FLAGS[arg]) {
    const value = args[++i];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for ${arg}`);
    const [group, code] = VALUE_FLAGS[arg];
    if (code) opts[group][code] = value;
    else opts[group] = value;
    continue;
  }
  if (arg.startsWith("--")) fail(`Unknown option: ${arg}\n${USAGE}`);
  if (opts.season) fail(`Unexpected extra argument: ${arg}`);
  opts.season = arg;
}

if (!opts.season) fail(`Missing <season> argument.\n${USAGE}`);
if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) fail(`--date must look like 2026-03-01 (got "${opts.date}")`);

// ---------- read the source folder ----------
const seasonDir = path.join(RAW_ROOT, opts.season);
let entries;
try {
  entries = await fs.readdir(seasonDir);
} catch {
  fail(
    `Source folder not found: ${path.relative(ROOT, seasonDir)}\n` + `  Create it and drop the photos inside, e.g. raw-images/${opts.season}/001.jpg`,
  );
}

const files = entries
  .filter((name) => !name.startsWith("."))
  .filter((name) => SUPPORTED.has(path.extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

const rejected = entries.filter((name) => !name.startsWith(".") && !SUPPORTED.has(path.extname(name).toLowerCase()));
if (rejected.length) {
  log(`! Skipping ${rejected.length} unsupported file(s): ${rejected.slice(0, 6).join(", ")}`);
  log(`  Supported: ${[...SUPPORTED].join(", ")}`);
}

if (files.length === 0) {
  fail(`No supported images in ${path.relative(ROOT, seasonDir)}. Nothing to do.`);
}

log(`\n${opts.dryRun ? "[dry-run] " : "[upload] "}${opts.season} — ${files.length} image(s)\n`);

// ---------- configure the destination ----------
let s3 = null;
let PutObjectCommand = null;
let bucket = "";
let publicUrl = "";

if (!opts.dryRun) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL, R2_ENDPOINT } = process.env;

  const missing = Object.entries({
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    fail(
      `Missing required environment variable(s): ${missing.join(", ")}\n` +
        `  Copy .env.example to .env and fill it in, or run with --dry-run to test locally.`,
    );
  }

  const endpoint = R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);
  if (!endpoint) fail("Missing R2_ACCOUNT_ID (or R2_ENDPOINT) — cannot build the R2 S3 endpoint.");

  const aws = await import("@aws-sdk/client-s3");
  PutObjectCommand = aws.PutObjectCommand;
  s3 = new aws.S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  bucket = R2_BUCKET;
  publicUrl = R2_PUBLIC_URL.replace(/\/+$/, "");
}

const mockDir = path.join(MOCK_ROOT, opts.season);
if (opts.dryRun) {
  await fs.mkdir(mockDir, { recursive: true });
}

// ---------- compress + publish ----------
const images = [];
let failures = 0;
let index = 0;

for (const file of files) {
  index += 1;
  const sourcePath = path.join(seasonDir, file);
  const key = `${opts.season}/${String(index).padStart(3, "0")}-${slug(path.basename(file, path.extname(file)))}.webp`;

  let data;
  let info;
  try {
    const result = await sharp(sourcePath)
      .rotate() // honour EXIF orientation
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true });
    data = result.data;
    info = result.info;
  } catch (error) {
    failures += 1;
    log(`  ✗ ${file} — could not be processed: ${error.message}`);
    continue;
  }

  const alt = `${opts.season} look ${index}`;

  if (opts.dryRun) {
    const destination = path.join(mockDir, path.basename(key));
    await fs.writeFile(destination, data);
    images.push({ url: `/mock-cdn/${key}`, alt, width: info.width, height: info.height });
    log(`  ✓ ${file} → /mock-cdn/${key}  (${info.width}×${info.height}, ${humanSize(data.length)})`);
    continue;
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = `${publicUrl}/${key}`;
    images.push({ url, alt, width: info.width, height: info.height });
    log(`  ✓ ${file} → ${url}  (${info.width}×${info.height}, ${humanSize(data.length)})`);
  } catch (error) {
    failures += 1;
    log(`  ✗ ${file} — upload failed: ${error.message}`);
  }
}

if (images.length === 0) {
  fail(`Every image failed (${failures} error(s)). The JSON file was left untouched.`);
}

if (failures > 0) {
  log(`\n! ${failures} image(s) failed and were excluded from the manifest.`);
}

// ---------- write the season manifest ----------
// One entry per locale; the default locale gets a derived label as a starting point.
const localizedOr = (given, fallback) =>
  Object.fromEntries(LOCALES.map((code) => [code, given[code] ?? (code === defaultLocale ? fallback : "")]));

const payload = {
  season: opts.season,
  date: opts.date || new Date().toISOString().slice(0, 10),
  seasonLabel: localizedOr(opts.label, deriveLabel(opts.season)),
  tag: localizedOr(opts.tag, "NOW AVAILABLE"),
  coverImage: images[0].url,
  images: images.map(({ url, alt, width, height }) => ({ url, alt, width, height })),
};

await fs.mkdir(GALLERY_DIR, { recursive: true });
const jsonPath = path.join(GALLERY_DIR, `${opts.season}.json`);
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

log(`\n✓ Wrote ${path.relative(ROOT, jsonPath)} — ${images.length} image(s), cover = first image.`);
const blank = LOCALES.filter((code) => !payload.seasonLabel[code]);
if (blank.length) log(`  ! seasonLabel missing for: ${blank.join(", ")} — pass --label-<locale> or edit the JSON.`);
if (opts.dryRun) log("  dry-run: URLs point at /mock-cdn/… — run `npm run dev` to preview.");
