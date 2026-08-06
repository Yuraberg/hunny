import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    category: z.string(),
    slogan: z.string().optional(),
    description: z.string(),
    price: z.number(),
    weight: z.string().optional(),
    imageFront: image(),
    imageBack: image().optional(),
    hasFlip: z.boolean().default(true),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    inStock: z.boolean().default(true),
    draft: z.boolean().default(false),
  }),
});

const stories = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    excerpt: z.string(),
    heroImage: image(),
    tags: z.array(z.enum(['мёд', 'пчёлы', 'пасека', 'рецепты', 'сезон'])).default([]),
    publishedDate: z.date(),
    author: z.string().default('Дмитрий Бердников'),
    draft: z.boolean().default(true),
  }),
});

const wiki = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/wiki' }),
  schema: z.object({
    title: z.string(),
    category: z.enum([
      'Термины',
      'Сорта мёда',
      'Пчёлы и породы',
      'Болезни и вредители',
      'Апитерапия и здоровье',
      'Пчеловодство',
    ]),
    excerpt: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { products, stories, wiki };
