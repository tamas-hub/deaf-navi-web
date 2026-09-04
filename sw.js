const OLD_BASE = '/deaf-navi-web';
const NEW_BASE = 'https://deafnavi.com';

function redirectUrl(url) {
  const path = url.pathname.startsWith(OLD_BASE)
    ? url.pathname.slice(OLD_BASE.length)
    : '/';
  return `${NEW_BASE}${path || '/'}${url.search}${url.hash}`;
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(Response.redirect(redirectUrl(new URL(event.request.url)), 302));
});
