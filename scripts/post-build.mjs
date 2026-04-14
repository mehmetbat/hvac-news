import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');

// news.json oku
const newsData = JSON.parse(
  readFileSync(resolve(rootDir, 'src/data/news.json'), 'utf-8')
);

// Tarihe göre sırala (en yeni önce)
const sorted = newsData.sort(
  (a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
);

// llms-full.txt üret
let llmsContent = `# HVAC Haber - Tüm Haberler
> Türkiye'nin lider HVAC sektörü haber portalı - Tam haber listesi

## Haberler (Türkçe)

`;

for (const item of sorted) {
  llmsContent += `### ${item.title.tr}\n`;
  llmsContent += `- URL: /${item.slug.tr}/\n`;
  llmsContent += `- Tarih: ${item.publishDate.split('T')[0]}\n`;
  llmsContent += `- Kategori: ${item.categoryLabel.tr}\n`;
  llmsContent += `- Özet: ${item.excerpt.tr}\n\n`;
}

llmsContent += `## News (English)\n\n`;

for (const item of sorted) {
  llmsContent += `### ${item.title.en}\n`;
  llmsContent += `- URL: /en/${item.slug.en}/\n`;
  llmsContent += `- Date: ${item.publishDate.split('T')[0]}\n`;
  llmsContent += `- Category: ${item.categoryLabel.en}\n`;
  llmsContent += `- Summary: ${item.excerpt.en}\n\n`;
}

writeFileSync(resolve(distDir, 'llms-full.txt'), llmsContent, 'utf-8');
console.log('llms-full.txt üretildi.');

// schemamap.xml üret
const categories = [...new Set(newsData.map((n) => n.category))];

let schemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<schemamap xmlns="https://www.hvachaber.com/schemamap">
  <page url="/" schemas="WebSite,Organization,ItemList" />
  <page url="/en/" schemas="WebSite,Organization,ItemList" />
`;

for (const cat of categories) {
  schemaXml += `  <page url="/kategori/${cat}/" schemas="CollectionPage,BreadcrumbList,ItemList" />\n`;
  schemaXml += `  <page url="/en/category/${cat}/" schemas="CollectionPage,BreadcrumbList,ItemList" />\n`;
}

for (const item of sorted) {
  schemaXml += `  <page url="/${item.slug.tr}/" schemas="NewsArticle,BreadcrumbList,Organization" />\n`;
  schemaXml += `  <page url="/en/${item.slug.en}/" schemas="NewsArticle,BreadcrumbList,Organization" />\n`;
}

schemaXml += `</schemamap>\n`;

writeFileSync(resolve(distDir, 'schemamap.xml'), schemaXml, 'utf-8');
console.log('schemamap.xml üretildi.');
