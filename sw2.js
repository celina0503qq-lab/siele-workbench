/* 西语学习系统 Service Worker · network-first
   策略：始终优先拉取网络最新版本（避免浏览器缓存导致页面停留在旧版、功能缺失），
   网络失败时才回退到缓存副本（离线可用）。 */
const CACHE = 'siele-suite-v94.5.2-202610102142';

// 核心资源 - 安装时预缓存
const CORE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
  /* v92.3: 移除 siele-tarea2-scenes.png（2.7MB）——T2 已全部改用本地小图 assets/images/t2-scenes/*.jpg */
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

/* 2026-09-26 新增：响应页面版本自检 —— 回传本 SW 的缓存版本，
   供 index.html 与页面内联 swVer 比对，不一致时弹「检测到新版本」横幅。
   ⚠️ 铁律：本文件的 CACHE 与 index.html 内联的 swVer 必须同步修改。 */
self.addEventListener('message', e => {
  try {
    if (e.data && e.data.type === 'SW_VER' && e.ports && e.ports[0]) {
      e.ports[0].postMessage({ type: 'SW_VER_RESULT', ver: CACHE });
    }
  } catch (err) { /* 忽略 */ }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 云同步等跨域请求不拦截
  const _p0 = url.pathname;
  /* v92.3: 静态图片「缓存优先 + 后台校验」——避免每次刷新都走网络（T2 场景图等） */
  if (/(\.png|\.jpe?g|\.webp|\.gif|\.svg|\.ico)$/i.test(_p0) || _p0.indexOf('/assets/images/') === 0) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(_p0) || await c.match(req);
      if (hit) {
        fetch(req).then(r => { if (r && r.ok) c.put(_p0, r.clone()); }).catch(() => {});
        return hit;
      }
      const fresh = await fetch(req);
      if (fresh && fresh.ok) { try { c.put(_p0, fresh.clone()); } catch (_e) {} }
      return fresh;
    })());
    return;
  }
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        /* v72: 完整性校验 —— 截断的响应不落缓存（Content-Length 不符或 HTML 缺尾标记即跳过） */
        const p0 = req.url.split('?')[0];
        let okToCache = true;
        try {
          if (/(\.html|\.js|\.css)$/.test(p0) || p0.endsWith('/')) {
            const cl = fresh.headers.get('content-length');
            const buf = await fresh.clone().arrayBuffer();
            if (cl && Number(cl) !== buf.byteLength) okToCache = false;
            if (okToCache && (p0.endsWith('index.html') || p0.endsWith('admin.html'))) {
              const tail = new TextDecoder().decode(buf.slice(-32)).trimEnd();
              if (!tail.endsWith('</html>')) okToCache = false;
            }
          }
        } catch (_e) { okToCache = false; }
        if (okToCache) {
          const c = await caches.open(CACHE);
          c.put(p0, fresh.clone());
        }
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
