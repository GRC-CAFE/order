importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 升级版本号至 v27，强制更新 Service Worker 规则
const CACHE_NAME = 'grc-cafe-v27';
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

// 1. 统一拦截所有推送，禁止双重弹窗，并强制指定目标 URL
self.addEventListener('push', (event) => {
  event.stopImmediatePropagation(); // 阻止后续监听器（包括 Firebase SDK 内部监听器）重复处理

  let title = 'GRC CAFE 提醒';
  let body = '本周新菜单上线啦，快来预订吧！';
  let targetUrl = 'https://grc-cafe.github.io/order/';

  if (event.data) {
    try {
      const payload = event.data.json();
      
      // 读取标题和内容
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      }
      if (payload.data) {
        title = payload.data.title || payload.data.notification_title || title;
        body = payload.data.body || payload.data.notification_body || body;
        if (payload.data.url) {
          targetUrl = payload.data.url;
        }
      }
      if (payload.fcmOptions && payload.fcmOptions.link) {
        targetUrl = payload.fcmOptions.link;
      }
    } catch (e) {
      console.log('Push payload parsing fallback:', event.data.text());
    }
  }

  const options = {
    body: body,
    icon: 'logo-192.png',
    tag: 'grc-cafe-notification', // 固定 tag 避免重复生成多条卡片
    renotify: true,
    data: {
      url: targetUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
}, true); // 捕获阶段拦截

// 2. 点击通知处理：彻底锁定跳转到 /order/
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = 'https://grc-cafe.github.io/order/';
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 若已有 /order/ 标签页打开，直接切过去
      for (let client of windowClients) {
        if (client.url.includes('/order/')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // 彻底杀死进程冷启动时，拉起 /order/
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

// 4. 激活与清理旧缓存
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

// 5. 网络拦截与离线策略
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
