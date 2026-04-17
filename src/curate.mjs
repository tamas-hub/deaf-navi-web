import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'docs');
const DATA_FILE = join(DATA_DIR, 'articles.json');

const MAX_ARTICLES = 150;

const KEYWORD_GROUPS = [
  { query: '聴覚障害 OR 難聴', defaultCategory: 'general' },
  { query: 'ろう者 OR ろうあ者 OR 中途失聴', defaultCategory: 'general' },
  { query: '手話 OR 情報保障', defaultCategory: 'general' },
  { query: '聴覚障害 制度 OR 聴覚障害 支援', defaultCategory: 'policy' },
  { query: 'site:jfd.or.jp', defaultCategory: 'general' },
  { query: 'site:asahi.com 聴覚障害', defaultCategory: 'general' },
  { query: 'site:yomiuri.co.jp 聴覚障害', defaultCategory: 'general' },
  { query: 'site:prtimes.jp 聴覚障害', defaultCategory: 'general' },
  { query: 'site:rehab.go.jp 聴覚障害', defaultCategory: 'medical' },
];

const DIRECT_FEEDS = [
  {
    url: 'https://www.jfd.or.jp/feed',
    sourceName: '全日本ろうあ連盟',
    sourceUrl: 'https://www.jfd.or.jp/',
    defaultCategory: 'general',
  },
  {
    url: 'https://www.jfd.or.jp/category/sl-act/feed',
    sourceName: '全日本ろうあ連盟（手話言語法）',
    sourceUrl: 'https://www.jfd.or.jp/',
    defaultCategory: 'policy',
  },
  {
    url: 'https://shikaku.in/feed/',
    sourceName: 'しかくタイムズ',
    sourceUrl: 'https://shikaku.in/',
    defaultCategory: 'general',
  },
  {
    url: 'https://www.tfd.deaf.tokyo/feed/',
    sourceName: '東京都聴覚障害者連盟',
    sourceUrl: 'https://www.tfd.deaf.tokyo/',
    defaultCategory: 'local',
  },
];

const RELEVANT_KEYWORDS = [
  '聴覚障害', '難聴', 'ろう者', 'ろうあ者', 'ろうあ', '聾者', '聾唖',
  'デフ', 'deaf', '手話', '情報保障', '字幕', '補聴器', '人工内耳',
  '新生児スクリーニング', '手話言語', '手話通訳', '要約筆記',
  '電話リレー', '音声認識', '聴力', '聴覚', '耳が聞こえ',
  '中途失聴', '難聴者', 'ろう学校', '聴覚特別支援',
];

function isRelevantArticle(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  return RELEVANT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

function guessCategory(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  if (/制度|政策|法律|条例|給付|支援|雇用|助成|補助|手当/.test(text)) return 'policy';
  if (/医療|病院|治療|手術|補聴器|人工内耳|診断|検査|耳鼻/.test(text)) return 'medical';
  if (/学校|教育|就学|大学|授業|入試|保育|幼稚|研究/.test(text)) return 'education';
  if (/都|道|府|県|市|区|町|村|地域|地方/.test(text)) return 'local';
  return 'general';
}

function buildUrl(query) {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=ja&gl=JP&ceid=JP:ja`;
}

function extractTag(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return plain?.[1]?.trim() ?? '';
}

function extractActualUrl(description, fallback) {
  const match = description.match(/href="(https?:\/\/(?!news\.google\.com\/)[^"]+)"/i);
  return match?.[1] ?? fallback;
}

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ')
    .replace(/&emsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&'); // &amp; は最後（多重エンコード対応）
}

function cleanHtml(text) {
  // 1) 多重エンコード対策: 変化しなくなるまで最大3回デコード（例: &amp;nbsp; → &nbsp; → 空白）
  let decoded = text;
  for (let i = 0; i < 3; i++) {
    const next = decodeEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  // 2) タグ除去・URL除去・残存する名前付きエンティティの除去・空白正規化
  return decoded
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&[a-zA-Z][a-zA-Z0-9]{1,20};/g, '') // デコード漏れのnamed entityを排除
    .replace(/\s+/g, ' ')
    .trim();
}

function parseItems(xml, defaultCategory, sourceOverride) {
  const results = [];
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  for (const match of itemMatches) {
    const block = match[1];
    const title = cleanHtml(extractTag(block, 'title'));
    const link = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const rawDescription = extractTag(block, 'description');
    const description = cleanHtml(rawDescription).substring(0, 200);
    const articleUrl = sourceOverride ? link : extractActualUrl(rawDescription, link);

    let sourceName;
    let sourceUrl;
    if (sourceOverride) {
      sourceName = sourceOverride.sourceName;
      sourceUrl = sourceOverride.sourceUrl;
    } else {
      const sourceMatch = block.match(/<source\s+url="([^"]*)"[^>]*>([^<]*)<\/source>/i);
      sourceName = sourceMatch?.[2]?.trim() ?? 'Google News';
      sourceUrl = sourceMatch?.[1]?.trim() ?? 'https://news.google.com/';
    }

    if (!title || !link) continue;

    let publishedAt;
    try {
      publishedAt = new Date(pubDate).toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    const category = guessCategory(title, description) ?? defaultCategory;

    results.push({
      id: articleUrl,
      title,
      summary: description,
      sourceName,
      sourceUrl,
      publishedAt,
      category,
    });
  }

  return results;
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DeafNaviWeb/1.0 (+https://github.com/)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function loadNews() {
  const allArticles = [];

  for (const feed of DIRECT_FEEDS) {
    try {
      const res = await fetchWithTimeout(feed.url, 15_000);
      if (!res.ok) {
        console.warn(`[skip] ${feed.sourceName}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseItems(xml, feed.defaultCategory, {
        sourceName: feed.sourceName,
        sourceUrl: feed.sourceUrl,
      });
      console.log(`[direct] ${feed.sourceName}: ${items.length} items`);
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[fail] ${feed.sourceName}: ${err.message}`);
    }
  }

  for (const { query, defaultCategory } of KEYWORD_GROUPS) {
    try {
      const res = await fetchWithTimeout(buildUrl(query), 15_000);
      if (!res.ok) {
        console.warn(`[skip] "${query}": HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseItems(xml, defaultCategory);
      console.log(`[google] "${query}": ${items.length} items`);
      allArticles.push(...items);
    } catch (err) {
      console.warn(`[fail] "${query}": ${err.message}`);
    }
  }

  if (allArticles.length === 0) {
    throw new Error('全フィード取得失敗。処理を中断します。');
  }

  const directSourceNames = new Set(DIRECT_FEEDS.map((f) => f.sourceName));
  const filtered = allArticles.filter(
    (a) => directSourceNames.has(a.sourceName) || isRelevantArticle(a.title, a.summary),
  );

  const seen = new Set();
  const deduped = filtered.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return deduped.slice(0, MAX_ARTICLES);
}

async function main() {
  console.log('Deaf Navi Web: キュレーション開始');
  const articles = await loadNews();
  console.log(`合計: ${articles.length}件（重複除去・関連性フィルタ後）`);

  await mkdir(DATA_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    count: articles.length,
    articles,
  };
  await writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`書き出し: ${DATA_FILE}`);
}

main().catch((err) => {
  console.error('キュレーション失敗:', err);
  process.exit(1);
});