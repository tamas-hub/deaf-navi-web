import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEW_BASE = 'https://deaf-navi.github.io/deaf-navi-web/';
const ISO_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ARTICLE_KEYS = ['id', 'title', 'summary', 'url', 'publishedAt', 'sourceName', 'sourceURL', 'category'];
const LEGACY_CATEGORIES = new Set(['all', 'policy', 'medical', 'education', 'culture', 'sports', 'local', 'general']);
const DOMESTIC_CATEGORIES = new Set([
  'policy', 'accessibility', 'relay', 'medical', 'education', 'technology',
  'culture', 'sports', 'safety', 'event', 'local', 'general',
]);
const WORLD_CATEGORIES = new Set([
  'accessibility', 'policy', 'medical', 'education', 'technology',
  'culture', 'sports', 'safety', 'general',
]);
const required = [
  'index.html',
  '404.html',
  'guide.html',
  'about.html',
  'otomado/index.html',
  'redirect.js',
  'sw.js',
  'robots.txt',
  'articles.json',
  'feed.xml',
  'sitemap.xml',
  'app/v1/manifest.json',
  'app/v1/ios-news-v1.json',
  'app/v1/ios-news-v2.json',
  'app/v1/ios-world-jp-v2.json',
  'app/v1/ios-world-original-v2.json',
];

for (const relative of required) {
  const info = await stat(join(ROOT, relative));
  if (!info.isFile() || info.size === 0) throw new Error(`${relative} is missing or empty`);
}

const index = await readFile(join(ROOT, 'index.html'), 'utf8');
const guide = await readFile(join(ROOT, 'guide.html'), 'utf8');
const redirectJs = await readFile(join(ROOT, 'redirect.js'), 'utf8');
const manifest = JSON.parse(await readFile(join(ROOT, 'app/v1/manifest.json'), 'utf8'));

if (!index.includes(NEW_BASE) || !index.includes('redirect.js')) throw new Error('root redirect is invalid');
if (!guide.includes(`${NEW_BASE}guide.html`)) throw new Error('guide redirect is invalid');
if (!redirectJs.includes('location.replace(target)')) throw new Error('redirect script is invalid');
if (manifest.appBaseUrl !== `${NEW_BASE}app/v1/`) throw new Error('manifest uses an unexpected API base URL');

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function verifyIosFeed(relative, categories) {
  const articles = JSON.parse(await readFile(join(ROOT, 'app', 'v1', relative), 'utf8'));
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error(`${relative}: iOS compatibility feed is empty`);
  }

  for (const [index, article] of articles.entries()) {
    const prefix = `${relative}[${index}]`;
    if (!article || typeof article !== 'object' || Array.isArray(article)) {
      throw new Error(`${prefix}: article must be an object`);
    }
    const keys = Object.keys(article);
    if (keys.length !== ARTICLE_KEYS.length || keys.some((key, keyIndex) => key !== ARTICLE_KEYS[keyIndex])) {
      throw new Error(`${prefix}: unexpected article keys`);
    }
    if (typeof article.id !== 'string' || article.id !== article.url || !isHttpUrl(article.url)) {
      throw new Error(`${prefix}: id and url must be the same HTTP(S) URL`);
    }
    if (typeof article.title !== 'string' || article.title.trim() === '') {
      throw new Error(`${prefix}: title is missing`);
    }
    if (typeof article.summary !== 'string') throw new Error(`${prefix}: summary must be a string`);
    if (typeof article.sourceName !== 'string' || article.sourceName.trim() === '') {
      throw new Error(`${prefix}: sourceName is missing`);
    }
    if (!isHttpUrl(article.sourceURL)) throw new Error(`${prefix}: sourceURL is invalid`);
    if (typeof article.publishedAt !== 'string' || !ISO_SECONDS.test(article.publishedAt)) {
      throw new Error(`${prefix}: publishedAt must use ISO-8601 UTC second precision`);
    }
    if (!categories.has(article.category)) throw new Error(`${prefix}: unsupported category ${article.category}`);
  }

  return articles.length;
}

const feedCounts = {
  domesticV1: await verifyIosFeed('ios-news-v1.json', LEGACY_CATEGORIES),
  domesticV2: await verifyIosFeed('ios-news-v2.json', DOMESTIC_CATEGORIES),
  worldJpV1: await verifyIosFeed('ios-world-jp-v1.json', LEGACY_CATEGORIES),
  worldJpV2: await verifyIosFeed('ios-world-jp-v2.json', WORLD_CATEGORIES),
  worldOriginalV1: await verifyIosFeed('ios-world-original-v1.json', LEGACY_CATEGORIES),
  worldOriginalV2: await verifyIosFeed('ios-world-original-v2.json', WORLD_CATEGORIES),
};

console.log(`Legacy redirect verification passed: ${JSON.stringify(feedCounts)}`);
