importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const CACHE_NAME = 'grc-cafe-v12';
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

// 离线/后台推送监听：仅当 Payload 中没有原生 notification 字段时才手动触发显示，防止双重弹窗
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) {
    // Firebase SDK 会自动渲染系统级通知，此处直接跳过避免重复
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

// 点击通知唤起网页（自动根据 SW 所在目录解析绝对路径，彻底解决点击 404 问题）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let rawUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';
  
  // 使用 self.registration.scope 作为基础路径，防止跳转到域名根目录或错误路径
  const targetUrl = new URL(rawUrl, self.registration.scope).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 如果网页已经打开，直接聚焦到该标签页
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 如果没有打开，开启新窗口加载页面
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
