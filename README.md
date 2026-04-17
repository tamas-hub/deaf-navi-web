# Deaf Navi Web

聴覚障害・難聴・ろう者コミュニティ向けのニュースキュレーションサイト。Deaf Navi アプリで利用している選定条件を流用し、静的サイトとして公開する。

## 概要

- **URL**: `https://<github-user>.github.io/deaf-navi-web/`（公開後に確定）
- **更新**: GitHub Actions が毎時 RSS を取得し `docs/` 配下を自動更新
- **ホスティング**: GitHub Pages（完全無料・SSL 付き）
- **スタック**: Node 20（標準 fetch のみ）+ 静的 HTML/CSS/JS

## 情報源（Deaf Navi アプリと同一）

### 直接 RSS フィード

- 全日本ろうあ連盟 (一般)
- 全日本ろうあ連盟 / 手話言語法カテゴリ
- しかくタイムズ
- 東京都聴覚障害者連盟

### Google News RSS（9 キーワード群）

- `聴覚障害 OR 難聴` / `ろう者 OR ろうあ者 OR 中途失聴` / `手話 OR 情報保障`
- `聴覚障害 制度 OR 聴覚障害 支援`
- `site:jfd.or.jp` / `site:asahi.com 聴覚障害` / `site:yomiuri.co.jp 聴覚障害`
- `site:prtimes.jp 聴覚障害` / `site:rehab.go.jp 聴覚障害`

### フィルタ

- **関連性**: 55 キーワード辞書で本文・タイトルを照合（直接フィードはパス）
- **カテゴリ自動分類**: policy / medical / education / local / general
- **重複除去**: 記事 URL キーで dedupe
- **並び**: `publishedAt` 降順

## ディレクトリ構成

```
deaf-navi-web/
├── .github/workflows/curate.yml  # 毎時 cron + 失敗時 Issue 自動作成
├── src/
│   ├── curate.mjs                # RSS 取得 → docs/articles.json
│   ├── build.mjs                 # docs/articles.json → docs/index.html
│   ├── styles.css                # UI スタイル
│   ├── app.js                    # フィルタボタン用クライアント JS
│   └── serve.mjs                 # ローカル確認用簡易サーバー
├── docs/                         # ← GitHub Pages 公開ディレクトリ
│   ├── index.html                # 自動生成
│   ├── articles.json             # 自動生成
│   ├── styles.css                # build でコピー
│   └── app.js                    # build でコピー
├── package.json
└── README.md
```

## ローカル開発

```bash
cd deaf-navi-web
npm run curate    # RSS 取得 → docs/articles.json
npm run build     # HTML 生成
npm run serve     # http://localhost:5173 で確認
```

一発: `npm run generate` で curate + build。

## デプロイ手順（初回）

1. **GitHub リポジトリ作成** (`deaf-navi-web`)
2. ローカルから `git push`
3. **リポジトリ Settings → Pages**:
    - Source: `Deploy from a branch`
    - Branch: `main` / `/docs`
4. **Actions 権限**: Settings → Actions → General → Workflow permissions を `Read and write permissions` に
5. 初回は Actions タブで `Curate & Build` を手動実行 (`Run workflow`)
6. 数分後、`https://<user>.github.io/deaf-navi-web/` にアクセスして確認

## 運用・メンテナンス

| 頻度 | 作業 | 担当 |
|---|---|---|
| 自動（毎時） | RSS 取得・記事更新・コミット | GitHub Actions |
| 自動（失敗時） | Issue 自動作成 | Actions |
| 月 1 | 情報源・キーワード辞書の見直し | rin エージェント |
| 都度 | 新カテゴリ・UI 改善 | PR |

### 情報源・キーワードの更新方法

`src/curate.mjs` を編集して PR → マージすれば、次回 cron から反映される。

- `DIRECT_FEEDS` に RSS URL を追加
- `KEYWORD_GROUPS` に Google News 検索クエリを追加
- `RELEVANT_KEYWORDS` でフィルタ語彙を調整
- `guessCategory` の正規表現でカテゴリ判定を調整

### Actions 失敗時の対応

- `curation-failure` ラベルの Issue が自動作成される
- 対象ソースの RSS が閉じた / Google News フォーマット変更が主因
- 通常は該当ソースを一時的にコメントアウトして再実行

### コスト

- **GitHub Pages**: 無料（ソフトリミット帯域 100GB/月）
- **GitHub Actions**: 無料枠 2000 分/月、本プロジェクトの使用量は毎時 1 分 × 24 × 30 ≒ 720 分/月で十分収まる
- **独自ドメイン**（オプション）: 取得費のみ（GitHub Pages 側の設定は無料）

## アクセシビリティ方針

- WCAG 2.1 AA 準拠を目標とする
- セマンティック HTML（`header` / `nav` / `main` / `article` / `time` / `footer`）
- キーボード操作完結・`focus-visible` 明示
- スキップリンク・`aria-pressed` による状態提示
- `prefers-color-scheme` でダークモード対応
- `prefers-reduced-motion` でアニメーション抑制
- 色依存に頼らずテキスト情報でも判別可能なカテゴリ表示

## ライセンス

- サイトのコード: MIT
- 記事の著作権: 各発信元に帰属（タイトル・要約・外部リンクのみ表示）