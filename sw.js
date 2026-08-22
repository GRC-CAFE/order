const CACHE_NAME = 'grc-cafe-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cafe1.jpeg',
  './dish1.jpeg',
  './dish2.jpeg',
  './dish3.jpeg',
  './qrcode.jpeg'
];

// 安装 Service Worker 并缓存静态资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 拦截请求，优先从网络获取最新数据，网络不可用时使用缓存
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});