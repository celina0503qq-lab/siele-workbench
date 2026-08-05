/* 西语学习系统 Service Worker · network-first
   策略：始终优先拉取网络最新版本（避免浏览器缓存导致页面停留在旧版、功能缺失），
   网络失败时才回退到缓存副本（离线可用）。 */
const CACHE = 'siele-suite-v9-fast-kick';

// 核心资源 - 安装时预缓存
const CORE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './assets/images/siele-tarea2-scenes.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 预缓存核心资源，失败不阻塞安装
    await Promise.allSettled(CORE_ASSETS.map(u => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 云同步等跨域请求不拦截
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(req.url.split('?')[0], fresh.clone());
      }
      return fresh;
    } catch (err) {
      const c = await caches.open(CACHE);
      const hit = await c.match(req.url.split('?')[0]) || await c.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
