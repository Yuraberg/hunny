// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeUnstubWikiLinks from './src/lib/rehype-unstub-wiki-links.ts';
import { lastmodForUrl } from './src/lib/sitemap-lastmod.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://medovayasloboda.ru',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.replace(/\/$/, '').startsWith('/order'),
      serialize(item) {
        const lastmod = lastmodForUrl(item.url);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  markdown: {
    processor: unified({ rehypePlugins: [rehypeUnstubWikiLinks] }),
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      // В проде nginx проксирует /api/* на отдельный сервис api/server.js —
      // здесь повторяем то же самое для `npm run dev`, чтобы форма заказа
      // работала одинаково локально и на сервере без адаптера Astro.
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
  }
});