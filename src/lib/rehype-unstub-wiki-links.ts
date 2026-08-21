import { visit, SKIP } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import stubs from '../content/wiki-stubs.json';

// Заглушки вики не индексируются и не должны получать внутренние ссылки —
// иначе поисковик всё равно найдёт их по ссылкам из других статей.
const stubSlugs = new Set(Object.keys(stubs));

export default function rehypeUnstubWikiLinks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'a' || !parent || index === undefined) return;

      const href = node.properties?.href;
      if (typeof href !== 'string' || !href.startsWith('/wiki/')) return;

      const slug = href.slice('/wiki/'.length).split(/[?#]/)[0];
      if (!stubSlugs.has(slug)) return;

      parent.children.splice(index, 1, ...node.children);
      return [SKIP, index + node.children.length];
    });
  };
}
