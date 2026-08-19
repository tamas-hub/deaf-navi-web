import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRedirects } from './build-redirects.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_BASE = 'https://deaf-navi.github.io/deaf-navi-web/';
const FILES = [
  'articles.json',
  'articles-old.json',
  'articles-world.json',
  'feed.xml',
  'feed-world.xml',
  'feed-world-original.xml',
  'feed-world-en.xml',
  'sitemap.xml',
  'sitemap-world.xml',
  'app/v1/manifest.json',
  'app/v1/index.json',
  'app/v1/domestic.json',
  'app/v1/world-jp.json',
  'app/v1/world-original.json',
  'app/v1/world-multilingual.json',
  'app/v1/ios-news-v1.json',
  'app/v1/ios-news-v2.json',
  'app/v1/ios-world-jp-v1.json',
  'app/v1/ios-world-jp-v2.json',
  'app/v1/ios-world-original-v1.json',
  'app/v1/ios-world-original-v2.json',
];

const downloaded = new Map();
for (const relative of FILES) {
  const response = await fetch(new URL(relative, SOURCE_BASE), {
    headers: { 'User-Agent': 'DeafNaviLegacySync/1.0' },
  });
  if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
  downloaded.set(relative, new Uint8Array(await response.arrayBuffer()));
}

for (const [relative, body] of downloaded) {
  const destination = join(ROOT, relative);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

await buildRedirects();
console.log(`Synced ${downloaded.size} compatibility files from ${SOURCE_BASE}`);
