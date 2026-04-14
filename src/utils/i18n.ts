import trTranslations from '../i18n/tr.json';
import enTranslations from '../i18n/en.json';

export type Lang = 'tr' | 'en';

const BASE = '/hvac-news';

const translations: Record<Lang, Record<string, string>> = {
  tr: trTranslations,
  en: enTranslations
};

export function t(key: string, lang: Lang): string {
  return translations[lang][key] ?? key;
}

export function withBase(path: string): string {
  return `${BASE}${path}`;
}

export function getLangFromUrl(url: URL): Lang {
  const pathname = url.pathname;
  if (pathname.includes('/en/') || pathname.endsWith('/en')) {
    return 'en';
  }
  return 'tr';
}

export function getLocalizedUrl(path: string, lang: Lang): string {
  if (lang === 'en') {
    return withBase(`/en${path}`);
  }
  return withBase(path);
}

export function getAlternateUrl(currentPath: string, currentLang: Lang): string {
  if (currentLang === 'tr') {
    return `/en${currentPath}`;
  }
  return currentPath.replace(/^\/en/, '') || '/';
}

export function formatDate(dateString: string, lang: Lang): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
