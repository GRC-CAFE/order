importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 升级缓存版本号，确保 GitHub Pages 更新后客户端能触发更新
const CACHE_NAME = 'grc-cafe-v19';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cafe1.jpeg',
  './cafe2.jpeg',
  './fri_dish1.jpeg',
  './sat_dish1.jpeg',
  './sat_dish2.jpeg',
  './sat_dessert.jpeg',
  './instruction.jpeg',
  './pwa.jpeg',
  './qrcode.jpeg',
  './logo-192.png',
  './logo-512.png',
  './manifest.json'
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

// 1. 离线/后台推送监听
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) {
    return; // 避免带有 notification 结构的载荷导致浏览器双重弹窗
  }

  const notificationTitle = (payload.data && payload.data.title) ? payload.data.title : 'GRC CAFE 提醒';
  const notificationOptions = {
    body: (payload.data && payload.data.body) ? payload.data.body : '本周新菜单上线啦，快来预订吧！',
    icon: 'logo-192.png',
    tag: 'grc-cafe-notification',
    renotify: true,
    data: {
      url: (payload.data && payload.data.url) ? payload.data.url : self.registration.scope
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. 点击通知处理：防跑偏、强行校正路径并唤起 PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let rawUrl = event.notification.data?.url || event.notification.click_action || self.registration.scope;
  let targetUrl = new URL(rawUrl, self.registration.scope).href;

  if (!targetUrl.startsWith(self.registration.scope)) {
    targetUrl = self.registration.scope;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (let client of windowClients) {
        if (client.url.startsWith(self.registration.scope)) {
          if ('navigate' in client && client.url !== targetUrl) {
            await client.navigate(targetUrl);
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 3. 安装与缓存预加载
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 4. 激活与旧缓存清理
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
  return self.clients.claim();
});

// 5. 网络拦截与离线缓存降级策略（防 API 拦截）
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // 排除第三方 API、Google Apps Script 及 Firebase 接口，避免被 SW 静态缓存拦截
  if (
    url.origin.includes('googleapis.com') || 
    url.origin.includes('firebase') || 
    url.origin.includes('script.google.com') ||
    url.origin.includes('googleusercontent.com')
  ) {
    return;
  }

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
