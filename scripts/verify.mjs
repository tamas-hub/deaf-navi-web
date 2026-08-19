import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEW_BASE = 'https://deaf-navi.github.io/deaf-navi-web/';
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
const iosNews = JSON.parse(await readFile(join(ROOT, 'app/v1/ios-news-v2.json'), 'utf8'));

if (!index.includes(NEW_BASE) || !index.includes('redirect.js')) throw new Error('root redirect is invalid');
if (!guide.includes(`${NEW_BASE}guide.html`)) throw new Error('guide redirect is invalid');
if (!redirectJs.includes('location.replace(target)')) throw new Error('redirect script is invalid');
if (manifest.appBaseUrl !== `${NEW_BASE}app/v1/`) throw new Error('manifest uses an unexpected API base URL');
if (!Array.isArray(iosNews) || iosNews.length === 0) throw new Error('iOS compatibility feed is empty');

console.log(`Legacy redirect verification passed: ${iosNews.length} iOS news items.`);
