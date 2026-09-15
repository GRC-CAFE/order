importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 升级版本号至 v26，强制手机端更新 Service Worker 规则
const CACHE_NAME = 'grc-cafe-v26';
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

// 1. 拦截原生 Push 事件（防止 Firebase SDK 默认逻辑接管导致跳转根域名）
self.addEventListener('push', (event) => {
  let title = 'GRC CAFE 提醒';
  let body = '本周新菜单上线啦，快来预订吧！';
  let targetUrl = 'https://grc-cafe.github.io/order/';

  if (event.data) {
    try {
      const payload = event.data.json();
      
      // 兼容 FCM 的 notification 和 data payload 结构
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      }
      if (payload.data) {
        title = payload.data.title || title;
        body = payload.data.body || body;
        if (payload.data.url) {
          targetUrl = payload.data.url;
        }
      }
      if (payload.fcmOptions && payload.fcmOptions.link) {
        targetUrl = payload.fcmOptions.link;
      }
    } catch (e) {
      console.log('Push data parse error/text:', event.data.text());
    }
  }

  const options = {
    body: body,
    icon: 'logo-192.png',
    tag: 'grc-cafe-notification',
    renotify: true,
    data: {
      url: targetUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Firebase SDK 后台消息兜底
messaging.onBackgroundMessage((payload) => {
  // 如果原生 push 已处理，此处直接 return 避免重复弹窗
  return;
});

// 2. 点击通知处理：防止彻底关闭 PWA (Cold Start) 时跳回根域名
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // 立即关闭通知弹窗

  // 预设写死精准绝对路径 https://grc-cafe.github.io/order/
  let targetUrl = 'https://grc-cafe.github.io/order/';
  
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1) 如果后台已有打开的 /order/ 页面，直接聚焦 (Focus)
      for (let client of windowClients) {
        if (client.url.includes('/order/')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }

      // 2) 若 PWA 完全杀死/冷启动，强制使用 openWindow 打开 /order/ 绝对路径
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

// 5. 网络拦截与离线缓存降级策略
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

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
