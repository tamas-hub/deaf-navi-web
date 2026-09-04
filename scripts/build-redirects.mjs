import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEW_BASE = 'https://deafnavi.com/';
const SOURCE_LOCATIONS = [
  { origin: 'https://deaf-navi.github.io', path: '/deaf-navi-web/' },
  { origin: 'https://deafnavi.com', path: '/' },
];
const LEGACY_HTML_PATHS = [
  'deaf-navi-world.html',
  'deaf-navi-world-en.html',
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function outputPathFor(urlValue) {
  const url = new URL(urlValue);
  const source = SOURCE_LOCATIONS.find((candidate) => (
    url.origin === candidate.origin && url.pathname.startsWith(candidate.path)
  ));
  if (!source) return null;

  const relative = url.pathname.slice(source.path.length);
  if (!relative) return 'index.html';
  if (relative.endsWith('/')) return join(relative, 'index.html');
  if (relative.endsWith('.html')) return relative;
  return null;
}

function targetForOutput(outputPath) {
  const normalized = outputPath.split('\\').join('/');
  if (normalized === 'index.html') return NEW_BASE;
  if (normalized.endsWith('/index.html')) {
    return new URL(normalized.slice(0, -'index.html'.length), NEW_BASE).href;
  }
  return new URL(normalized, NEW_BASE).href;
}

function redirectPage(target) {
  const safeTarget = escapeHtml(target);
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Deaf Navi Webは移転しました</title>
  <link rel="canonical" href="${safeTarget}">
  <script src="/deaf-navi-web/redirect.js"></script>
  <meta http-equiv="refresh" content="0; url=${safeTarget}">
  <style>
    body { margin: 0; color: #162622; background: #f4f7f6; font-family: system-ui, sans-serif; }
    main { max-width: 42rem; margin: 12vh auto; padding: 2rem; border-left: 4px solid #08766d; background: #fff; }
    h1 { margin-top: 0; font-size: 1.5rem; }
    a { color: #075e57; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Deaf Navi Webは移転しました</h1>
    <p>新しいページへ移動しています。</p>
    <p><a data-new-location href="${safeTarget}">移動しない場合はこちらを開いてください</a></p>
  </main>
</body>
</html>
`;
}

export async function buildRedirects() {
  const sitemap = await readFile(join(ROOT, 'sitemap.xml'), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const targets = new Map();

  for (const location of locations) {
    const outputPath = outputPathFor(location);
    if (outputPath) targets.set(outputPath, targetForOutput(outputPath));
  }
  for (const relative of LEGACY_HTML_PATHS) {
    targets.set(relative, `${NEW_BASE}${relative}`);
  }

  for (const [outputPath, target] of targets) {
    const destination = join(ROOT, outputPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, redirectPage(target), 'utf8');
  }

  await writeFile(join(ROOT, '404.html'), redirectPage(NEW_BASE), 'utf8');
  console.log(`Built ${targets.size} redirect pages and 404.html.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildRedirects();
}
