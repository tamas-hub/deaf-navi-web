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
const OG_SRC = join(__dirname, 'og-image.svg');
const OG_OUT = join(DOCS, 'og-image.svg');

const SITE_URL = 'https://tamas-hub.github.io/deaf-navi-web/';
const SITE_NAME = 'Deaf Navi Web';
const SITE_TAGLINE = '聴覚障害・難聴・ろう者コミュニティの最新ニュース';
const SITE_DESC = '聴覚障害・難聴・ろう者コミュニティ向けに、全日本ろうあ連盟や主要報道機関から最新ニュースを厳選。制度・政策・医療・教育・地域情報を毎時自動更新するキュレーションサイト。手話・情報保障・補聴器・人工内耳・手話言語条例など幅広いテーマをカバー。';
const SITE_KEYWORDS = '聴覚障害,難聴,ろう者,ろうあ者,中途失聴,手話,情報保障,補聴器,人工内耳,手話言語条例,聴覚障害ニュース,手話ニュース,難聴者,デフ,deaf,字幕,電話リレー,要約筆記,ろう学校,聴覚特別支援';

const CATEGORY_ORDER = ['all', 'policy', 'medical', 'education', 'culture', 'local', 'general'];
const CATEGORY_UI = {
  all: 'すべて',
  policy: '制度・政策',
  medical: '医療',
  education: '教育',
  culture: '文化・芸能',
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

/** ISO → "YYYY-MM-DD HH:mm JST"（日本標準時固定） */
function formatDateJST(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(d).slice(0, 16)} JST`;
}

function relativeTime(iso) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '今';
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
          <time class="card__time" datetime="${escapeHtml(a.publishedAt)}" title="${escapeHtml(formatDateJST(a.publishedAt))}">${escapeHtml(relativeTime(a.publishedAt))}</time>
        </header>
        <h3 class="card__title">
          <a href="${escapeHtml(a.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
        </h3>
        <p class="card__summary">${escapeHtml(a.summary)}</p>
        <footer class="card__foot">
          <a class="card__source" href="${escapeHtml(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.sourceName)}</a>
        </footer>
      </article>`;
}

function renderFilterButtons() {
  const filters = CATEGORY_ORDER.map(
    (c) =>
      `<button type="button" class="filter${c === 'all' ? ' is-active' : ''}" data-filter="${c}" aria-pressed="${c === 'all' ? 'true' : 'false'}">${CATEGORY_UI[c]}</button>`,
  ).join('\n          ');
  const aboutLink = `<a class="filter filter--about" href="./about.html" target="_blank" rel="noopener">Deaf Naviについて<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg></a>`;
  return `${filters}\n          ${aboutLink}`;
}

/** 構造化データ JSON-LD（WebSite + Organization + ItemList of NewsArticle） */
function renderJsonLd({ generatedAt, articles }) {
  const topArticles = articles.slice(0, 30); // ItemListは上位30件に絞る
  const itemList = topArticles.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: a.id,
    item: {
      '@type': 'NewsArticle',
      '@id': a.id,
      headline: a.title,
      url: a.id,
      datePublished: a.publishedAt,
      dateModified: a.publishedAt,
      inLanguage: 'ja-JP',
      description: a.summary,
      publisher: {
        '@type': 'Organization',
        name: a.sourceName,
        url: a.sourceUrl,
      },
      articleSection: CATEGORY_UI[a.category] ?? '一般',
    },
  }));

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: 'Deaf Navi ニュース',
        description: SITE_DESC,
        inLanguage: 'ja-JP',
        dateModified: generatedAt,
        publisher: { '@id': `${SITE_URL}#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}#organization`,
        name: 'TAMA',
        url: SITE_URL,
      },
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}#webpage`,
        url: SITE_URL,
        name: `${SITE_NAME} | ${SITE_TAGLINE}`,
        description: SITE_DESC,
        inLanguage: 'ja-JP',
        isPartOf: { '@id': `${SITE_URL}#website` },
        dateModified: generatedAt,
        about: [
          { '@type': 'Thing', name: '聴覚障害' },
          { '@type': 'Thing', name: '難聴' },
          { '@type': 'Thing', name: 'ろう者' },
          { '@type': 'Thing', name: '手話' },
          { '@type': 'Thing', name: '情報保障' },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE_URL}#itemlist`,
        name: '聴覚障害関連ニュース最新記事',
        numberOfItems: topArticles.length,
        itemListElement: itemList,
      },
    ],
  };

  return `<script type="application/ld+json">
${JSON.stringify(data, null, 2)}
</script>`;
}

function renderPage({ generatedAt, count, articles }) {
  const articlesHtml = articles.map(renderArticle).join('\n');
  const generatedLocal = formatDateJST(generatedAt);
  const jsonLd = renderJsonLd({ generatedAt, articles });

  const pageTitle = `${SITE_NAME} | ${SITE_TAGLINE} - 毎時自動更新`;
  const ogImage = `${SITE_URL}og-image.svg`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(SITE_DESC)}">
  <meta name="keywords" content="${escapeHtml(SITE_KEYWORDS)}">
  <meta name="author" content="TAMA">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <meta name="googlebot" content="index,follow">
  <meta name="theme-color" content="#5a7a48">

  <link rel="canonical" href="${SITE_URL}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)}" href="${SITE_URL}feed.xml">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(SITE_DESC)}">
  <meta property="og:url" content="${SITE_URL}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Deaf Navi Web - 聴覚障害・ろう者向けニュースキュレーション">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:updated_time" content="${escapeHtml(generatedAt)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(SITE_DESC)}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:image:alt" content="Deaf Navi Web - 聴覚障害・ろう者向けニュースキュレーション">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Shippori+Mincho+B1:wght@500;600;700&display=swap">
  <link rel="stylesheet" href="./styles.css">

  ${jsonLd}
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
      <p class="site-lead">聴覚障害・難聴・ろう者コミュニティのための、静かで確かなニュースキュレーション。手話・情報保障・制度・医療・教育・地域情報を毎時自動更新。</p>
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
        <h2 id="articles-heading">最新ニュース</h2>
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
      <p>Deaf Navi Web は <a href="https://www.jfd.or.jp/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟</a>・<a href="https://www.tfd.deaf.tokyo/" target="_blank" rel="noopener noreferrer">東京都聴覚障害者連盟</a> 等のRSSフィードと Google News RSS を情報源にしています。</p>
      <p>記事の著作権は各発信元に帰属します。リンク先は外部サイトです。更新は自動で1時間毎に行われます。</p>
      <p><a href="${SITE_URL}feed.xml">RSSフィード</a> ・ <a href="${SITE_URL}sitemap.xml">サイトマップ</a></p>
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

function renderAboutPage() {
  const aboutJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}about.html`,
    url: `${SITE_URL}about.html`,
    name: `Deaf Naviについて | ${SITE_NAME}`,
    description: 'Deaf Navi Web のコンセプト・情報源・更新頻度・運営者情報。',
    inLanguage: 'ja-JP',
    isPartOf: { '@id': `${SITE_URL}#website` },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deaf Naviについて | ${escapeHtml(SITE_NAME)}</title>
  <meta name="description" content="Deaf Navi Web のコンセプト、情報源、更新頻度、運営者（TAMA）についてのご案内。聴覚障害・ろう者コミュニティ向けニュースキュレーションサイトのポリシー・背景情報。">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${SITE_URL}about.html">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="Deaf Naviについて | ${escapeHtml(SITE_NAME)}">
  <meta property="og:description" content="Deaf Navi Web のコンセプト・情報源・更新頻度・運営者情報。">
  <meta property="og:url" content="${SITE_URL}about.html">
  <meta property="og:image" content="${SITE_URL}og-image.svg">
  <meta property="og:locale" content="ja_JP">
  <meta name="theme-color" content="#5a7a48">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Shippori+Mincho+B1:wght@500;600;700&display=swap">
  <link rel="stylesheet" href="./styles.css">

  <script type="application/ld+json">
${JSON.stringify(aboutJsonLd, null, 2)}
  </script>
</head>
<body>
  <a class="skip-link" href="#main">メインコンテンツにスキップ</a>

  <header class="site-header site-header--slim" role="banner">
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
      <p class="site-breadcrumb"><a href="./">Deaf Navi Web</a> <span aria-hidden="true">›</span> <span>Deaf Naviについて</span></p>
      <h1 class="site-title site-title--small"><span class="site-title__brand">Deaf Naviについて</span></h1>
    </div>
  </header>

  <main id="main" class="container about" role="main">
    <section aria-labelledby="about-concept">
      <h2 id="about-concept" class="about__h2">このサイトについて</h2>
      <p>Deaf Navi Web は、<strong>聴覚障害・難聴・ろう者・中途失聴者</strong>のコミュニティに関わる情報を、信頼できる情報源から自動収集・分類してお届けする無料ニュースキュレーションサイトです。毎時自動更新されるため、常に最新の動向を確認できます。</p>
      <p>「Take it easy」を合言葉に、情報保障・手話・制度・医療・教育・文化など、暮らしと権利に直結するトピックを幅広くカバーします。</p>
    </section>

    <section aria-labelledby="about-sources">
      <h2 id="about-sources" class="about__h2">情報源</h2>
      <h3 class="about__h3">専門媒体（直接RSS）</h3>
      <ul>
        <li><a href="https://www.jfd.or.jp/" target="_blank" rel="noopener noreferrer">全日本ろうあ連盟</a> — 全国規模の連盟公式情報（制度・手話言語法を含む）</li>
        <li><a href="https://www.tfd.deaf.tokyo/" target="_blank" rel="noopener noreferrer">東京都聴覚障害者連盟</a> — 地域連盟の活動情報</li>
        <li><a href="https://shikaku.in/" target="_blank" rel="noopener noreferrer">しかくタイムズ</a> — ろう者・難聴者向けイベント情報</li>
        <li><a href="https://co-coco.jp/" target="_blank" rel="noopener noreferrer">こここ</a> — マガジンハウス運営の福祉クリエイティブマガジン</li>
        <li><a href="https://ameblo.jp/jtd2009/" target="_blank" rel="noopener noreferrer">日本ろう者劇団</a> — 手話狂言・公演情報</li>
      </ul>
      <h3 class="about__h3">主要報道機関・公的機関（Google News RSS）</h3>
      <ul>
        <li>朝日新聞・読売新聞・PR TIMES・国立リハビリテーションセンター 等</li>
        <li>キーワード: 聴覚障害 / 難聴 / ろう者 / 手話 / 情報保障 / 制度・支援 / ろう文化・芸能 ほか</li>
      </ul>
    </section>

    <section aria-labelledby="about-categories">
      <h2 id="about-categories" class="about__h2">カテゴリ分類</h2>
      <p>記事はタイトル・要約から自動で以下のカテゴリに分類されます:</p>
      <ul>
        <li><strong>制度・政策</strong> — 法律・条例・給付・雇用・助成など</li>
        <li><strong>医療</strong> — 病院・治療・補聴器・人工内耳・診断など</li>
        <li><strong>教育</strong> — 学校・大学・授業・入試・研究など</li>
        <li><strong>文化・芸能</strong> — ろう演劇・ろう映画・手話パフォーマンス・ろうアート・手話狂言など</li>
        <li><strong>地域</strong> — 都道府県・市区町村単位のローカル情報</li>
        <li><strong>一般</strong> — 上記以外の関連トピック</li>
      </ul>
    </section>

    <section aria-labelledby="about-update">
      <h2 id="about-update" class="about__h2">更新頻度・仕組み</h2>
      <p>GitHub Actions による自動ジョブが毎時（UTC 0分／JST 毎時9分）にRSSを収集。関連性フィルタ・重複除去・カテゴリ分類を行い、最新150件を表示しています。</p>
      <p>記事の本文・要約は各発信元のものを抜粋し、本文リンクはすべて各元記事の原文（外部サイト）に遷移します。記事の著作権はそれぞれの発信元に帰属します。</p>
    </section>

    <section aria-labelledby="about-operator">
      <h2 id="about-operator" class="about__h2">運営</h2>
      <p>Deaf Navi Web は <strong>TAMA</strong> が運営しています。本サイトは Deaf Navi iOS アプリのニュースキュレーション機能を Web 版として提供するものです。</p>
      <p>アプリ版: <a href="https://apps.apple.com/jp/app/deaf-navi/id6761352199" target="_blank" rel="noopener noreferrer">App Store で Deaf Navi を開く</a></p>
    </section>

    <section aria-labelledby="about-feeds">
      <h2 id="about-feeds" class="about__h2">配信・共有</h2>
      <ul>
        <li><a href="${SITE_URL}feed.xml">RSS フィード</a>（最新50件）</li>
        <li><a href="${SITE_URL}sitemap.xml">サイトマップ</a></li>
      </ul>
    </section>

    <p class="about__back"><a href="./">← トップページへ戻る</a></p>
  </main>

  <footer class="site-footer" role="contentinfo">
    <div class="container">
      <p class="site-footer__copyright">
        <span>&copy; ${new Date().getFullYear()} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span>Curated for the Deaf &amp; Hard-of-hearing community.</span>
      </p>
    </div>
  </footer>
</body>
</html>
`;
}

function renderSitemap({ generatedAt }) {
  const lastmod = new Date(generatedAt).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}about.html</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Disallow: /articles.json$

Sitemap: ${SITE_URL}sitemap.xml
`;
}

function renderRss({ generatedAt, articles }) {
  const items = articles.slice(0, 50).map((a) => {
    const pubDate = new Date(a.publishedAt).toUTCString();
    return `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(a.id)}</link>
      <guid isPermaLink="true">${escapeXml(a.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(a.summary)}</description>
      <category>${escapeXml(CATEGORY_UI[a.category] ?? '一般')}</category>
      <source url="${escapeXml(a.sourceUrl)}">${escapeXml(a.sourceName)}</source>
    </item>`;
  }).join('\n');

  const lastBuildDate = new Date(generatedAt).toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}feed.xml" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESC)}</description>
    <language>ja-JP</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>
`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

  await writeFile(join(DOCS, 'about.html'), renderAboutPage(), 'utf8');
  console.log(`書き出し: ${join(DOCS, 'about.html')}`);

  await writeFile(join(DOCS, 'sitemap.xml'), renderSitemap(data), 'utf8');
  console.log(`書き出し: ${join(DOCS, 'sitemap.xml')}`);

  await writeFile(join(DOCS, 'robots.txt'), renderRobots(), 'utf8');
  console.log(`書き出し: ${join(DOCS, 'robots.txt')}`);

  await writeFile(join(DOCS, 'feed.xml'), renderRss(data), 'utf8');
  console.log(`書き出し: ${join(DOCS, 'feed.xml')}`);

  if (await fileExists(STYLES_SRC)) {
    await copyFile(STYLES_SRC, STYLES_OUT);
    console.log(`コピー: ${STYLES_OUT}`);
  }
  if (await fileExists(APP_SRC)) {
    await copyFile(APP_SRC, APP_OUT);
    console.log(`コピー: ${APP_OUT}`);
  }
  if (await fileExists(OG_SRC)) {
    await copyFile(OG_SRC, OG_OUT);
    console.log(`コピー: ${OG_OUT}`);
  }
}

main().catch((err) => {
  console.error('ビルド失敗:', err);
  process.exit(1);
});
