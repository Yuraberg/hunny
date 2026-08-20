// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import wikiStubs from './src/content/wiki-stubs.json' with { type: 'json' };

// Страницы-заглушки энциклопедии ("статья скоро появится") — тонкий дублирующийся
// контент, который не должен попадать в индекс поисковиков.
const stubPaths = new Set(Object.keys(wikiStubs).map((slug) => `/wiki/${slug}`));

// https://astro.build/config
export default defineConfig({
  site: 'https://medovayasloboda.ru',
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return !stubPaths.has(path) && !path.startsWith('/order');
      },
    }),
  ],
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