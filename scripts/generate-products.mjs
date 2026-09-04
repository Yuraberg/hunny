import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsDir = path.join(__dirname, '../src/content/products');
const outFile = path.join(__dirname, '../worker/products.generated.json');
const apiOutFile = path.join(__dirname, '../api/products.generated.json');

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('No frontmatter found');
  const [, fm, body] = match;
  const data = {};
  for (const line of fm.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    else value = value.replace(/^['"]|['"]$/g, '');
    data[key] = value;
  }
  return { data, body: body.trim() };
}

const files = readdirSync(productsDir).filter((f) => f.endsWith('.md'));
const products = [];
// Все непроданные (не draft) товары, доступные к покупке в корзине — включая
// подарочные наборы, которые sommelier-worker намеренно не рекомендует.
const apiProducts = [];

for (const file of files) {
  const id = file.replace(/\.md$/, '');
  const raw = readFileSync(path.join(productsDir, file), 'utf-8');
  const { data, body } = parseFrontmatter(raw);
  if (data.draft) continue;

  apiProducts.push({ id, price: data.price, weightGrams: data.weightGrams ?? 900 });

  if (data.category === 'Подарочный набор') continue;

  const description = body.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();

  products.push({
    id,
    name: data.name,
    category: data.category,
    description,
    botanicalSource: data.botanicalSource ?? null,
    tasteProfile: data.tasteProfile ?? null,
    benefits: data.benefits ?? null,
    recommendedFor: data.recommendedFor ?? null,
    restrictions: data.restrictions ?? null,
    allergyNote: data.allergyNote ?? null,
  });
}

products.sort((a, b) => a.id.localeCompare(b.id));
apiProducts.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(outFile, JSON.stringify(products, null, 2) + '\n');
writeFileSync(apiOutFile, JSON.stringify(apiProducts, null, 2) + '\n');
console.log(`Generated ${products.length} products -> ${path.relative(process.cwd(), outFile)}`);
console.log(`Generated ${apiProducts.length} products -> ${path.relative(process.cwd(), apiOutFile)}`);
