import newsData from '../data/news.json';
import type { Lang } from './i18n';

export interface NewsItem {
  id: string;
  slug: Record<Lang, string>;
  title: Record<Lang, string>;
  excerpt: Record<Lang, string>;
  content: Record<Lang, string>;
  category: string;
  categoryLabel: Record<Lang, string>;
  image: string;
  imageAlt: Record<Lang, string>;
  author: string;
  publishDate: string;
  featured: boolean;
  readingTime: number;
  tags: Record<Lang, string[]>;
}

export function getAllNews(): NewsItem[] {
  return (newsData as NewsItem[]).sort(
    (a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
  );
}

export function getFeaturedNews(): NewsItem[] {
  return getAllNews().filter((item) => item.featured);
}

export function getNewsByCategory(category: string): NewsItem[] {
  return getAllNews().filter((item) => item.category === category);
}

export function getNewsBySlug(slug: string, lang: Lang): NewsItem | undefined {
  return getAllNews().find((item) => item.slug[lang] === slug);
}

export function getRelatedNews(currentId: string, category: string, limit = 3): NewsItem[] {
  return getAllNews()
    .filter((item) => item.id !== currentId && item.category === category)
    .slice(0, limit);
}

export function getAllCategories(): { slug: string; label: Record<Lang, string> }[] {
  const categoryMap = new Map<string, Record<Lang, string>>();
  for (const item of getAllNews()) {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, item.categoryLabel);
    }
  }
  return Array.from(categoryMap.entries()).map(([slug, label]) => ({ slug, label }));
}

export function getAllSlugs(lang: Lang): string[] {
  return getAllNews().map((item) => item.slug[lang]);
}
