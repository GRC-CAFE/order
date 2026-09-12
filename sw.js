importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const CACHE_NAME = 'grc-cafe-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cafe1.jpeg',
  './instruction.jpeg',
  './pwa.jpeg',
  './qrcode.jpeg',
  './logo-192.png',
  './logo-512.png'
];

firebase.initializeApp({
  apiKey: "AIzaSyBQ0p9wjbzNbxiUnPOHvcoPoL8EZpHrn94",
  authDomain: "grc-cafe-pwa.firebaseapp.com",
  projectId: "grc-cafe-pwa",
  storageBucket: "grc-cafe-pwa.firebasestorage.app",
  messagingSenderId: "922576960907",
  appId: "1:922576960907:web:f316e5009b2ac1edc8838e"
});

const messaging = firebase.messaging();

// 离线/后台推送监听：仅当 Payload 中没有原生 notification 字段时才手动触发显示
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) {
    // 即使 Firebase 渲染了通知，通过统一传递自定义 data 数据覆盖点击行为
    return;
  }

  const notificationTitle = (payload.data && payload.data.title) ? payload.data.title : 'GRC CAFE 提醒';
  const notificationOptions = {
    body: (payload.data && payload.data.body) ? payload.data.body : '本周新菜单上线啦，快来预订吧！',
    icon: 'logo-192.png',
    data: {
      url: (payload.data && payload.data.url) ? payload.data.url : './'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 点击通知处理：唤起 PWA 窗口或打开新窗口
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let rawUrl = './';
  if (event.notification.data && event.notification.data.url) {
    rawUrl = event.notification.data.url;
  }

  // 解析出目标绝对 URL
  const targetUrl = new URL(rawUrl, self.registration.scope).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. 尝试匹配域名作用域内的所有已有窗口/PWA 进程
      for (let client of windowClients) {
        const clientUrl = new URL(client.url, self.registration.scope).href;
        
        // 忽略 URL 结尾斜线和参数差异，只要匹配到已安装的 PWA 实例/页面即直接聚焦
        if (clientUrl.startsWith(self.registration.scope)) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }

      // 2. 如果没有找到已打开的 PWA 页面，新建窗口打开 PWA
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 安装与缓存预加载
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 激活与旧缓存清理
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 网络拦截与离线缓存降级策略
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
