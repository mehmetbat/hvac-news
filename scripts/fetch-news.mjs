/**
 * HVAC Haber RSS Fetcher
 * RSS kaynaklarından haberleri çeker, duplicate filtreler, raw-news.json oluşturur.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = resolve(__dirname, 'sources.json');
const RAW_NEWS_PATH = resolve(__dirname, 'raw-news.json');
const NEWS_PATH = resolve(__dirname, '..', 'src/data/news.json');
const MAX_ITEMS_PER_SOURCE = 5;

// Basit XML parser — RSS/Atom feed'leri için yeterli
function parseRSSItems(xml) {
  const items = [];

  // RSS 2.0 <item> formatı
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      description: extractTag(itemXml, 'description'),
      pubDate: extractTag(itemXml, 'pubDate'),
      content: extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'description')
    });
  }

  // Atom <entry> formatı (RSS bulunamazsa)
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/) ||
                         entryXml.match(/<link[^>]*>([^<]*)<\/link>/);
      items.push({
        title: extractTag(entryXml, 'title'),
        link: linkMatch ? linkMatch[1] : '',
        description: extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'),
        pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated'),
        content: extractTag(entryXml, 'content') || extractTag(entryXml, 'summary')
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  // CDATA destekli
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim().replace(/<[^>]+>/g, '') : '';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mevcut haberlerin URL'lerini topla (duplicate kontrolü)
function getExistingUrls() {
  const urls = new Set();

  // news.json'daki mevcut haberler
  if (existsSync(NEWS_PATH)) {
    const existing = JSON.parse(readFileSync(NEWS_PATH, 'utf-8'));
    for (const item of existing) {
      if (item.sourceUrl) urls.add(item.sourceUrl);
    }
  }

  // raw-news.json'daki bekleyen haberler
  if (existsSync(RAW_NEWS_PATH)) {
    const raw = JSON.parse(readFileSync(RAW_NEWS_PATH, 'utf-8'));
    for (const item of raw) {
      if (item.sourceUrl) urls.add(item.sourceUrl);
    }
  }

  return urls;
}

async function fetchFeed(source) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HVACHaber/1.0 (news aggregator)'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`  ✗ ${source.name}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const items = parseRSSItems(xml);
    console.log(`  ✓ ${source.name}: ${items.length} haber bulundu`);
    return items.slice(0, MAX_ITEMS_PER_SOURCE).map((item) => ({
      ...item,
      sourceId: source.id,
      sourceName: source.name,
      sourceLang: source.lang,
      sourceUrl: item.link
    }));
  } catch (error) {
    console.error(`  ✗ ${source.name}: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('🔍 HVAC haber kaynakları taranıyor...\n');

  const sources = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
  const activeSources = sources.filter((s) => s.active);
  const existingUrls = getExistingUrls();

  console.log(`📡 ${activeSources.length} aktif kaynak, ${existingUrls.size} mevcut haber\n`);

  // Tüm feed'leri paralel çek
  const results = await Promise.all(activeSources.map(fetchFeed));
  const allItems = results.flat();

  // Duplicate filtrele
  const newItems = allItems.filter((item) => {
    if (!item.sourceUrl) return false;
    return !existingUrls.has(item.sourceUrl);
  });

  // Son 7 günden eski haberleri filtrele
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentItems = newItems.filter((item) => {
    if (!item.pubDate) return true; // Tarih yoksa dahil et
    const date = new Date(item.pubDate).getTime();
    return date > sevenDaysAgo;
  });

  // Temizle ve kaydet
  const cleanedItems = recentItems.map((item) => ({
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceLang: item.sourceLang,
    sourceUrl: item.sourceUrl,
    originalTitle: stripHtml(item.title),
    originalContent: stripHtml(item.content || item.description || ''),
    originalExcerpt: stripHtml(item.description || '').slice(0, 300),
    pubDate: item.pubDate || new Date().toISOString(),
    fetchedAt: new Date().toISOString()
  }));

  // İçeriği boş olanları filtrele
  const validItems = cleanedItems.filter(
    (item) => item.originalTitle.length > 10 && item.originalContent.length > 50
  );

  console.log(`\n📊 Sonuç:`);
  console.log(`   Toplam çekilen: ${allItems.length}`);
  console.log(`   Duplicate: ${allItems.length - newItems.length}`);
  console.log(`   Eski (>7 gün): ${newItems.length - recentItems.length}`);
  console.log(`   Geçersiz: ${cleanedItems.length - validItems.length}`);
  console.log(`   ✅ Yeni haber: ${validItems.length}`);

  if (validItems.length > 0) {
    writeFileSync(RAW_NEWS_PATH, JSON.stringify(validItems, null, 2), 'utf-8');
    console.log(`\n💾 ${validItems.length} haber raw-news.json'a kaydedildi.`);
  } else {
    console.log('\n📭 Yeni haber bulunamadı.');
    // Boş array yaz ki rewrite script hata vermesin
    writeFileSync(RAW_NEWS_PATH, '[]', 'utf-8');
  }
}

main().catch(console.error);
