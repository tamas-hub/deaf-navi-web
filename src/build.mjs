import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DOCS = join(ROOT, 'docs');
const DATA_FILE = join(DOCS, 'articles.json');
const HTML_OUT = join(DOCS, 'index.html');
const STYLES_SRC = join(__dirname, 'styles.css');
const STYLES_OUT = join(DOCS, 'styles.css');
const APP_SRC = join(__dirname, 'app.js');
const APP_OUT = join(DOCS, 'app.js');

const CATEGORY_ORDER = ['all', 'policy', 'medical', 'education', 'local', 'general'];
const CATEGORY_UI = {
  all: 'すべて',
  policy: '制度・政策',
  medical: '医療',
  education: '教育',
  local: '地域',
  general: '一般',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function relativeTime(iso) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

function renderArticle(a) {
  const catLabel = CATEGORY_UI[a.category] ?? '一般';
  return `
      <article class="card" data-category="${escapeHtml(a.category)}">
        <header class="card__head">
          <span class="chip chip--${escapeHtml(a.category)}">${escapeHtml(catLabel)}</span>
          <time class="card__time" datetime="${escapeHtml(a.publishedAt)}" title="${escapeHtml(formatDate(a.publishedAt))}">${escapeHtml(relativeTime(a.publishedAt))}</time>
        </header>
        <h2 class="card__title">
          <a href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
        </h2>
        <p class="card__summary">${escapeHtml(a.summary)}</p>
        <footer class="card__foot">
          <a class="card__source" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.sourceName)}</a>
        </footer>
      </article>`;
}

function renderFilterButtons() {
  return CATEGORY_ORDER.map(
    (c) =>
      `<button type="button" class="filter${c === 'all' ? ' is-active' : ''}" data-filter="${c}" aria-pressed="${c === 'all' ? 'true' : 'false'}">${CATEGORY_UI[c]}</button>`,
  ).join('\n          ');
}

function renderPage({ generatedAt, count, articles }) {
  const articlesHtml = articles.map(renderArticle).join('\n');
  const generatedLocal = formatDate(generatedAt);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deaf Navi Web - 聴覚障害・ろう者向けニュースキュレーション</title>
  <meta name="description" content="聴覚障害・難聴・ろう者コミュニティ向けに厳選したニュースを一覧できるキュレーションサイト。制度・医療・教育・地域情報を定期更新。">
  <meta name="theme-color" content="#0b3d91">
  <meta property="og:title" content="Deaf Navi Web">
  <meta property="og:description" content="聴覚障害・ろう者コミュニティ向けニュースキュレーション">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Shippori+Mincho+B1:wght@500;600;700&display=swap">
  <link rel="stylesheet" href="./styles.css">
  <link rel="canonical" href="./">
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header" role="banner">
    <div class="site-header__leaf" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M40 170 C 40 110, 70 60, 160 30 C 150 100, 110 150, 40 170 Z" />
        <path d="M40 170 C 70 140, 100 110, 160 30" />
        <path d="M70 145 C 75 130, 85 115, 110 95" opacity="0.8" />
        <path d="M95 135 C 100 120, 115 105, 135 85" opacity="0.8" />
        <path d="M55 160 C 60 150, 75 130, 95 115" opacity="0.6" />
      </svg>
    </div>
    <div class="container">
      <h1 class="site-title"><span class="site-title__brand">Deaf Navi</span><span class="site-title__sub">Web</span></h1>
      <p class="site-lead">聴覚障害・ろう者コミュニティのための、静かで確かなニュースキュレーション。</p>
    </div>
  </header>

  <nav class="filters" role="navigation" aria-label="カテゴリフィルター">
    <div class="container">
      <div class="filters__row" role="group" aria-label="カテゴリで絞り込む">
          ${renderFilterButtons()}
      </div>
    </div>
  </nav>

  <main id="main" class="container" role="main">
    <section aria-labelledby="articles-heading">
      <div class="articles-head">
        <h2 id="articles-heading" class="sr-only">記事一覧</h2>
        <p class="meta">
          全 <strong id="total-count">${count}</strong> 件 /
          最終更新: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedLocal)}</time>
        </p>
      </div>
      <div id="articles" class="articles">
${articlesHtml}
      </div>
      <p id="empty-msg" class="empty" hidden>該当する記事がありません。</p>

      <aside class="app-cta" aria-label="Deaf Navi アプリのご案内">
        <div class="app-cta__text">
          <span class="app-cta__label">iPhone App</span>
          <h2 class="app-cta__title">外出先でも、Deaf Navi を。</h2>
          <p class="app-cta__desc">同じキュレーションをスマホからも閲覧できる iOS アプリ「Deaf Navi」。緊急カード・手話ガイド・制度情報をオフラインでも。</p>
        </div>
        <a class="app-cta__btn" href="https://apps.apple.com/jp/app/deaf-navi/id6761352199" target="_blank" rel="noopener noreferrer">
          App Store で見る
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M7 17L17 7"/>
            <path d="M8 7h9v9"/>
          </svg>
        </a>
      </aside>
    </section>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p>Deaf Navi Web は <a href="https://www.jfd.or.jp/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟</a> 等のRSSフィードと Google News RSS を情報源にしています。</p>
      <p>記事の著作権は各発信元に帰属します。リンク先は外部サイトです。更新は自動で1時間毎に行われます。</p>
      <hr class="site-footer__divider" aria-hidden="true">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>

  <script src="./app.js" defer></script>
</body>
</html>
`;
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const raw = await readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);

  await mkdir(DOCS, { recursive: true });
  await writeFile(HTML_OUT, renderPage(data), 'utf8');
  console.log(`書き出し: ${HTML_OUT}`);

  if (await fileExists(STYLES_SRC)) {
    await copyFile(STYLES_SRC, STYLES_OUT);
    console.log(`コピー: ${STYLES_OUT}`);
  }
  if (await fileExists(APP_SRC)) {
    await copyFile(APP_SRC, APP_OUT);
    console.log(`コピー: ${APP_OUT}`);
  }
}

main().catch((err) => {
  console.error('ビルド失敗:', err);
  process.exit(1);
});