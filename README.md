# Deaf Navi Web legacy redirect

`tamas-hub.github.io/deaf-navi-web` から
`deafnavi.com` への移転案内と互換配信を担当するリポジトリです。

- HTML: 同じパスの新サイトへ転送
- iOS API: `app/v1/*.json` を実ファイルとして互換配信
- RSS・公開JSON: 新サイトから1日3回同期
- 検索エンジン: 旧HTMLのcanonicalで `deafnavi.com` を正規URLとして案内

旧PagesとiOS互換JSONは最低2027年9月5日まで維持し、アプリの旧URL利用が
なくなったことを確認するまで削除・転送しません。

このリポジトリに新しいコンテンツは追加しません。正本は
<https://github.com/deaf-navi/deaf-navi-web> です。
