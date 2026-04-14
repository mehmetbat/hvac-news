import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://inovair.com.tr',
  base: '/hvac-news',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    assets: '_assets',
    inlineStylesheets: 'auto'
  },
  integrations: [
    tailwind(),
    sitemap({
      i18n: {
        defaultLocale: 'tr',
        locales: { tr: 'tr-TR', en: 'en-US' }
      }
    })
  ],
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' }
  }
});
