export interface WikiCategoryMeta {
  name: string;
  slug: string;
  description: string;
}

export const WIKI_CATEGORIES: WikiCategoryMeta[] = [
  {
    name: 'Сорта мёда',
    slug: 'sorta-meda',
    description: 'Ботаническое происхождение, вкус, цвет и особенности разных сортов мёда — от гречишного до липового.',
  },
  {
    name: 'Пчёлы и породы',
    slug: 'pchely-i-porody',
    description: 'Породы медоносных пчёл, их характер, продуктивность и особенности разведения.',
  },
  {
    name: 'Болезни и вредители',
    slug: 'bolezni-i-vrediteli',
    description: 'Болезни пчелиных семей, вредители пасеки и методы профилактики и лечения.',
  },
  {
    name: 'Апитерапия и здоровье',
    slug: 'apiterapiya-i-zdorove',
    description: 'Продукты пчеловодства и их традиционное применение — справочный материал, не медицинская рекомендация.',
  },
  {
    name: 'Пчеловодство',
    slug: 'pchelovodstvo',
    description: 'Практика пасечника: инвентарь, сезонные работы, содержание и развитие пчелиных семей.',
  },
  {
    name: 'Анатомия и физиология',
    slug: 'anatomiya-i-fiziologiya',
    description: 'Строение тела пчелы и физиологические процессы пчелиной семьи.',
  },
  {
    name: 'Медоносные растения',
    slug: 'medonosnye-rasteniya',
    description: 'Растения-медоносы Самарского края и их роль в медосборе.',
  },
  {
    name: 'Наука и стандарты',
    slug: 'nauka-i-standarty',
    description: 'ГОСТы, лабораторные показатели и научные исследования о мёде и пчеловодстве.',
  },
  {
    name: 'Термины',
    slug: 'terminy',
    description: 'Специальные термины пчеловодства и медологии простым языком.',
  },
];

export function categoryBySlug(slug: string): WikiCategoryMeta | undefined {
  return WIKI_CATEGORIES.find((c) => c.slug === slug);
}
