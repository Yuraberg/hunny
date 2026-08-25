import { execSync } from 'node:child_process';

const cache = new Map<string, string | undefined>();

function gitLastMod(relativePath: string): string | undefined {
  if (cache.has(relativePath)) return cache.get(relativePath);
  let result: string | undefined;
  try {
    const out = execSync(`git log -1 --format=%cI -- "${relativePath}"`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    result = out || undefined;
  } catch {
    result = undefined;
  }
  cache.set(relativePath, result);
  return result;
}

// Сопоставление URL сайта с исходным файлом в репозитории — источник для
// lastmod в sitemap.xml. Список путей соответствует src/pages/*; для
// content collections (products/stories/wiki) берём конкретный .md по slug.
function sourceFileForPathname(pathname: string): string | undefined {
  const p = pathname.replace(/\/$/, '') || '/';

  const staticPages: Record<string, string> = {
    '/': 'src/pages/index.astro',
    '/catalog': 'src/pages/catalog/index.astro',
    '/wiki': 'src/pages/wiki/index.astro',
    '/stories': 'src/pages/stories/index.astro',
    '/mir-pchel': 'src/pages/mir-pchel.astro',
    '/o-paseke': 'src/pages/o-paseke.astro',
    '/dostavka-i-oplata': 'src/pages/dostavka-i-oplata.astro',
    '/kontakty': 'src/pages/kontakty.astro',
    '/otzyvy': 'src/pages/otzyvy.astro',
    '/privacy': 'src/pages/privacy.astro',
  };
  if (staticPages[p]) return staticPages[p];

  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/catalog\/([^/]+)$/))) return `src/content/products/${m[1]}.md`;
  if ((m = p.match(/^\/wiki\/category\/[^/]+$/))) return 'src/pages/wiki/category/[slug].astro';
  if ((m = p.match(/^\/wiki\/([^/]+)$/))) return `src/content/wiki/${m[1]}.md`;
  if ((m = p.match(/^\/stories\/([^/]+)$/))) return `src/content/stories/${m[1]}.md`;

  return undefined;
}

export function lastmodForUrl(url: string): string | undefined {
  const pathname = new URL(url).pathname;
  const file = sourceFileForPathname(pathname);
  return file ? gitLastMod(file) : undefined;
}
