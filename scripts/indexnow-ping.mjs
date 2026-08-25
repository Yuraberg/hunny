// Уведомляет IndexNow (Яндекс/Bing/…) об изменившихся URL после деплоя.
// Список меняется определяется через git diff между коммитами пуша
// (INDEXNOW_BEFORE_SHA/INDEXNOW_AFTER_SHA от github.event.before/after);
// если диапазон недоступен или задет общий шаблон/компонент/конфиг —
// безопасный fallback: уведомить весь sitemap.
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const HOST = 'medovayasloboda.ru';
const SITE_URL = `https://${HOST}`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

const GLOBAL_PREFIXES = ['src/layouts/', 'src/components/', 'src/styles/', 'src/lib/'];
const GLOBAL_FILES = ['astro.config.mjs', 'package.json', 'package-lock.json'];

// Шаблоны, генерирующие много страниц из одного файла — при их изменении
// уведомляем все URL, порождённые этим шаблоном.
const TEMPLATE_PATTERNS = {
  'src/pages/wiki/[slug].astro': /^\/wiki\/[^/]+$/,
  'src/pages/wiki/category/[slug].astro': /^\/wiki\/category\/[^/]+$/,
  'src/pages/catalog/[slug].astro': /^\/catalog\/[^/]+$/,
  'src/pages/stories/[slug].astro': /^\/stories\/[^/]+$/,
};

const STATIC_PAGE_TO_PATHNAME = {
  'src/pages/index.astro': '/',
  'src/pages/catalog/index.astro': '/catalog',
  'src/pages/wiki/index.astro': '/wiki',
  'src/pages/stories/index.astro': '/stories',
  'src/pages/mir-pchel.astro': '/mir-pchel',
  'src/pages/o-paseke.astro': '/o-paseke',
  'src/pages/dostavka-i-oplata.astro': '/dostavka-i-oplata',
  'src/pages/kontakty.astro': '/kontakty',
  'src/pages/otzyvy.astro': '/otzyvy',
  'src/pages/privacy.astro': '/privacy',
};

function findKey() {
  const publicDir = path.join(root, 'public');
  const file = readdirSync(publicDir).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
  if (!file) throw new Error('IndexNow key file not found in public/');
  return file.replace(/\.txt$/, '');
}

function readSitemapEntries() {
  const xml = readFileSync(path.join(root, 'dist', 'sitemap-0.xml'), 'utf-8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.map((loc) => ({ loc, pathname: new URL(loc).pathname.replace(/\/$/, '') || '/' }));
}

function changedFiles(before, after) {
  if (!before || !after || /^0+$/.test(before)) return null;
  try {
    const out = execSync(`git diff --name-only ${before} ${after}`, { cwd: root }).toString().trim();
    return out ? out.split('\n') : [];
  } catch (err) {
    console.warn(`[indexnow] git diff failed, falling back to full sitemap: ${err.message}`);
    return null;
  }
}

function isGlobalChange(file) {
  return GLOBAL_FILES.includes(file) || GLOBAL_PREFIXES.some((p) => file.startsWith(p));
}

function pathnameForContentFile(file) {
  let m;
  if ((m = file.match(/^src\/content\/products\/([^/]+)\.md$/))) return `/catalog/${m[1]}`;
  if ((m = file.match(/^src\/content\/wiki\/([^/]+)\.md$/))) return `/wiki/${m[1]}`;
  if ((m = file.match(/^src\/content\/stories\/([^/]+)\.md$/))) return `/stories/${m[1]}`;
  return STATIC_PAGE_TO_PATHNAME[file] ?? null;
}

async function pingIndexNow(key, keyLocation, urlList) {
  if (urlList.length === 0) {
    console.log('[indexnow] nothing to notify');
    return;
  }
  if (process.env.INDEXNOW_DRY_RUN) {
    console.log(`[indexnow] dry run — would submit ${urlList.length} URL(s):\n${urlList.join('\n')}`);
    return;
  }
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
  });
  const body = await res.text().catch(() => '');
  console.log(`[indexnow] submitted ${urlList.length} URL(s), status ${res.status}${body ? ` — ${body}` : ''}`);
}

async function main() {
  const key = findKey();
  const keyLocation = `${SITE_URL}/${key}.txt`;
  const entries = readSitemapEntries();

  const files = changedFiles(process.env.INDEXNOW_BEFORE_SHA, process.env.INDEXNOW_AFTER_SHA);

  let urls;
  if (files === null) {
    console.log('[indexnow] no diff range available — notifying full sitemap');
    urls = entries.map((e) => e.loc);
  } else if (files.some(isGlobalChange)) {
    console.log('[indexnow] shared layout/component/style/config changed — notifying full sitemap');
    urls = entries.map((e) => e.loc);
  } else {
    const pathnames = new Set();
    for (const file of files) {
      const templatePattern = TEMPLATE_PATTERNS[file];
      if (templatePattern) {
        entries.filter((e) => templatePattern.test(e.pathname)).forEach((e) => pathnames.add(e.pathname));
        continue;
      }
      const pathname = pathnameForContentFile(file);
      if (pathname) pathnames.add(pathname);
    }
    const byPathname = new Map(entries.map((e) => [e.pathname, e.loc]));
    urls = [...pathnames].map((p) => byPathname.get(p)).filter(Boolean);
    console.log(`[indexnow] ${files.length} file(s) changed → ${urls.length} URL(s) to notify`);
  }

  await pingIndexNow(key, keyLocation, urls);
}

main().catch((err) => {
  // Пинг — best-effort уведомление, а не критичный шаг деплоя: сайт уже
  // выложен и работает, поэтому не роняем весь workflow из-за него.
  console.error(`[indexnow] failed: ${err.stack ?? err.message}`);
});
