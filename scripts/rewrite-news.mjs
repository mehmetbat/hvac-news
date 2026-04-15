/**
 * HVAC Haber AI Rewriter
 * raw-news.json'daki haberleri Claude API ile TR+EN orijinal içeriğe dönüştürür.
 * Çıktı: news.json'a eklenir.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_NEWS_PATH = resolve(__dirname, 'raw-news.json');
const NEWS_PATH = resolve(__dirname, '..', 'src/data/news.json');
const MAX_NEWS_TOTAL = 50; // Sitede max haber sayısı (eski haberler düşer)
const MAX_REWRITE_PER_RUN = 10; // Tek seferde max rewrite (API maliyeti kontrolü)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable gerekli.');
  process.exit(1);
}

const CATEGORIES = [
  { slug: 'isitma-sogutma', tr: 'Isıtma & Soğutma', en: 'Heating & Cooling', keywords: ['heat pump', 'boiler', 'chiller', 'cooling', 'heating', 'refrigerant', 'compressor', 'condenser', 'evaporator', 'COP', 'SEER', 'radiant', 'geothermal', 'R-290', 'R-32', 'R-410A'] },
  { slug: 'havalandirma', tr: 'Havalandırma', en: 'Ventilation', keywords: ['ventilation', 'air quality', 'IAQ', 'HVAC duct', 'air handler', 'AHU', 'HRV', 'ERV', 'exhaust', 'fresh air', 'filtration', 'HEPA', 'CO2'] },
  { slug: 'iklimlendirme', tr: 'İklimlendirme', en: 'Air Conditioning', keywords: ['air conditioning', 'AC', 'VRF', 'split', 'fan coil', 'ducted', 'mini-split', 'multi-split', 'inverter', 'dehumidifier'] },
  { slug: 'sektor-haberleri', tr: 'Sektör Haberleri', en: 'Industry News', keywords: ['market', 'industry', 'regulation', 'standard', 'acquisition', 'merger', 'revenue', 'growth', 'exhibition', 'fair', 'conference', 'award', 'partnership'] },
  { slug: 'haber', tr: 'Haber', en: 'News', keywords: [] }
];

function detectCategory(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  let bestMatch = CATEGORIES[CATEGORIES.length - 1]; // fallback: "haber"
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    const score = cat.keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }

  return bestMatch;
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[ığüşöç]/g, (c) => ({ ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c' })[c] || c)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function rewriteArticle(rawItem) {
  const isTurkish = rawItem.sourceLang === 'tr';
  const langNote = isTurkish
    ? 'Aşağıdaki Türkçe haberi kaynak olarak kullanarak, HEM TÜRKÇE HEM İNGİLİZCE orijinal haber makalesi yaz.'
    : 'Aşağıdaki İngilizce haberi kaynak olarak kullanarak, HEM TÜRKÇE HEM İNGİLİZCE orijinal haber makalesi yaz.';

  const prompt = `Sen bir HVAC (Isıtma, Soğutma, Havalandırma, İklimlendirme) sektörü gazetecisisin.

${langNote} Kaynak haberi kopyalama, tamamen kendi cümlelerinle yeniden yaz.

KAYNAK HABER:
Başlık: ${rawItem.originalTitle}
İçerik: ${rawItem.originalContent.slice(0, 1500)}

KURALLAR:
1. İçerik en az 3 paragraf olsun
2. İlk paragraf net bir "topic sentence" ile başlasın (LLM'lerin snippet çekmesi için)
3. Teknik detaylar koru ama dili sade tut
4. Türkiye bağlamını ekle (mümkünse sektöre etkisini belirt)
5. SEO uyumlu başlık yaz (60-70 karakter ideal)
6. Excerpt/özet max 155 karakter olsun (meta description)
7. Her iki dilde de 3-5 tag öner

ÇIKTI FORMATI (SADECE JSON, başka bir şey yazma):
{
  "title": {
    "tr": "Türkçe başlık",
    "en": "English title"
  },
  "excerpt": {
    "tr": "Türkçe özet (max 155 karakter)",
    "en": "English excerpt (max 155 chars)"
  },
  "content": {
    "tr": "Türkçe tam içerik (paragraflar \\n\\n ile ayrılmış)",
    "en": "English full content (paragraphs separated by \\n\\n)"
  },
  "tags": {
    "tr": ["tag1", "tag2", "tag3"],
    "en": ["tag1", "tag2", "tag3"]
  },
  "imageAlt": {
    "tr": "Görsel açıklaması",
    "en": "Image description"
  }
}`;

  const result = await callClaude(prompt);

  // JSON parse — bazen Claude markdown code block ile sarar
  const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

async function main() {
  console.log('🤖 AI Rewrite başlıyor...\n');

  // Raw haberleri oku
  if (!existsSync(RAW_NEWS_PATH)) {
    console.log('📭 raw-news.json bulunamadı. Önce fetch-news.mjs çalıştırın.');
    return;
  }

  const rawNews = JSON.parse(readFileSync(RAW_NEWS_PATH, 'utf-8'));
  if (rawNews.length === 0) {
    console.log('📭 Yeni haber yok, rewrite atlanıyor.');
    return;
  }

  // Mevcut haberleri oku
  const existingNews = existsSync(NEWS_PATH)
    ? JSON.parse(readFileSync(NEWS_PATH, 'utf-8'))
    : [];

  const toProcess = rawNews.slice(0, MAX_REWRITE_PER_RUN);
  console.log(`📝 ${toProcess.length} haber yeniden yazılacak...\n`);

  const newArticles = [];

  for (let i = 0; i < toProcess.length; i++) {
    const raw = toProcess[i];
    console.log(`  [${i + 1}/${toProcess.length}] ${raw.originalTitle.slice(0, 60)}...`);

    try {
      const rewritten = await rewriteArticle(raw);

      // Zorunlu alanların varlığını kontrol et
      if (!rewritten.title?.tr || !rewritten.title?.en ||
          !rewritten.content?.tr || !rewritten.content?.en ||
          !rewritten.excerpt?.tr || !rewritten.excerpt?.en) {
        console.error(`    ✗ Eksik alan — atlanıyor`);
        continue;
      }

      const category = detectCategory(raw.originalTitle, raw.originalContent);
      const now = new Date().toISOString();

      // Okuma süresi tahmini (kelime sayısından)
      const wordCount = (rewritten.content.tr || '').split(/\s+/).length;
      const readingTime = Math.max(2, Math.ceil(wordCount / 200));

      const article = {
        id: generateSlug(rewritten.title.en || raw.originalTitle),
        slug: {
          tr: generateSlug(rewritten.title.tr),
          en: generateSlug(rewritten.title.en)
        },
        title: rewritten.title,
        excerpt: rewritten.excerpt,
        content: rewritten.content,
        category: category.slug,
        categoryLabel: { tr: category.tr, en: category.en },
        image: `${category.slug}.svg`,
        imageAlt: rewritten.imageAlt || { tr: rewritten.title.tr, en: rewritten.title.en },
        author: 'HVAC Haber',
        publishDate: raw.pubDate || now,
        featured: i === 0, // İlk haber featured olsun
        readingTime,
        tags: rewritten.tags,
        sourceUrl: raw.sourceUrl,
        sourceName: raw.sourceName
      };

      newArticles.push(article);
      console.log(`    ✓ Başarılı`);

      // API rate limit - 2 saniye bekle
      if (i < toProcess.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error(`    ✗ Hata: ${error.message}`);
    }
  }

  if (newArticles.length === 0) {
    console.log('\n❌ Hiçbir haber yeniden yazılamadı.');
    return;
  }

  // Yeni haberleri mevcut listenin başına ekle
  const allNews = [...newArticles, ...existingNews];

  // Duplicate slug kontrolü
  const seenSlugs = new Set();
  const dedupedNews = allNews.filter((item) => {
    const key = item.slug.tr;
    if (seenSlugs.has(key)) return false;
    seenSlugs.add(key);
    return true;
  });

  // Max haber sayısını koru (eski haberler düşer)
  const finalNews = dedupedNews.slice(0, MAX_NEWS_TOTAL);

  // Featured: sadece en yeni haber featured olsun
  const updatedNews = finalNews.map((item, index) => ({
    ...item,
    featured: index === 0
  }));

  writeFileSync(NEWS_PATH, JSON.stringify(updatedNews, null, 2), 'utf-8');
  console.log(`\n✅ ${newArticles.length} yeni haber eklendi.`);
  console.log(`📰 Toplam: ${updatedNews.length} haber (max ${MAX_NEWS_TOTAL})`);

  // raw-news.json temizle (işlenmiş haberler)
  const remaining = rawNews.slice(MAX_REWRITE_PER_RUN);
  writeFileSync(RAW_NEWS_PATH, JSON.stringify(remaining, null, 2), 'utf-8');
  console.log(`📋 Kalan işlenmemiş: ${remaining.length}`);
}

main().catch(console.error);
