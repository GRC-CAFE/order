importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const CACHE_NAME = 'grc-cafe-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './cafe1.jpeg',
  './instruction.jpeg',
  './pwa.jpeg',
  './qrcode.jpeg',
  './logo-192.png'
];

try {
  firebase.initializeApp({
    apiKey: "AIzaSyBQ0p9wjbzNbxiUnPOHvcoPoL8EZpHrn94",
    authDomain: "grc-cafe-pwa.firebaseapp.com",
    projectId: "grc-cafe-pwa",
    storageBucket: "grc-cafe-pwa.appspot.com",
    messagingSenderId: "922576960907",
    appId: "1:922576960907:web:f316e5009b2ac1edc8838e"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification ? payload.notification.title : 'GRC CAFE 提醒';
    const notificationOptions = {
      body: payload.notification ? payload.notification.body : '本周新菜单上线啦，快来预订吧！',
      icon: 'logo-192.png',
      data: {
        url: payload.data && payload.data.url ? payload.data.url : './'
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch(e) {
  console.warn("FCM Messaging background error ignored on older Android:", e);
}

// 点击通知唤起网页
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data ? event.notification.data.url : './';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 安装与缓存管理
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

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

// 优化后的安全 fetch 拦截策略：排除跨域 API，防止低版本 Android 系统报错
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // 如果是跨域 API 或后端提交请求，直接跳过缓存逻辑走标准网络请求
  if (url.includes('script.google.com') || url.includes('googleapis.com') || url.includes('fcm.googleapis.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(() => {
        // 如果断网且没有缓存，避免抛出底层系统崩溃异常
        return new Response('Network Error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
