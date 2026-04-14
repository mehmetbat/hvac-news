import type { Lang } from './i18n';

const SITE_URL = 'https://inovair.com.tr/hvac-news';
const SITE_NAME = 'HVAC Haber';

export interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url: string;
  type?: 'website' | 'article';
  lang: Lang;
  publishDate?: string;
  author?: string;
  alternateUrl?: string;
}

export function getFullUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export function getPageTitle(title: string): string {
  return `${title} | ${SITE_NAME}`;
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.png`,
    description: "Türkiye'nin HVAC sektörü haber portalı",
    sameAs: []
  };
}

export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: ['tr-TR', 'en-US'],
    publisher: generateOrganizationSchema()
  };
}

export function generateNewsArticleSchema(article: {
  title: string;
  description: string;
  image: string;
  url: string;
  publishDate: string;
  author: string;
  lang: Lang;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description,
    image: `${SITE_URL}/images/news/${article.image}`,
    url: getFullUrl(article.url),
    datePublished: article.publishDate,
    dateModified: article.publishDate,
    author: {
      '@type': 'Person',
      name: article.author
    },
    publisher: generateOrganizationSchema(),
    inLanguage: article.lang === 'tr' ? 'tr-TR' : 'en-US',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': getFullUrl(article.url)
    }
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getFullUrl(item.url)
    }))
  };
}

export function generateItemListSchema(items: { name: string; url: string; position: number }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      url: getFullUrl(item.url)
    }))
  };
}

export function generateCollectionPageSchema(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: getFullUrl(url)
  };
}
