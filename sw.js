importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 升级版本号至 v28，强制手机端更新
const CACHE_NAME = 'grc-cafe-v28';
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

// 1. 仅当收到纯 Data 消息（无系统 notification 字段）时才手动弹窗，防止双弹窗
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) {
    return; // 系统已自动显示通知，此处直接跳过
  }

  const title = (payload.data && payload.data.title) ? payload.data.title : 'GRC CAFE 提醒';
  const body = (payload.data && payload.data.body) ? payload.data.body : '本周新菜单上线啦，快来预订吧！';
  const targetUrl = (payload.data && payload.data.url) ? payload.data.url : 'https://grc-cafe.github.io/order/';

  self.registration.showNotification(title, {
    body: body,
    icon: 'logo-192.png',
    tag: 'grc-cafe-notification',
    data: { url: targetUrl }
  });
});

// 2. 核心：劫持所有通知点击，死锁跳转到 /order/ 路径
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // 无论来自 Firebase 默认通知还是自定义通知，强行指定为 /order/
  let targetUrl = 'https://grc-cafe.github.io/order/';

  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  } else if (event.notification.data && event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.notification && event.notification.data.FCM_MSG.notification.click_action) {
    targetUrl = event.notification.data.FCM_MSG.notification.click_action;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1) 若后台已有打开的 /order/ 页面，直接切换过去
      for (let client of windowClients) {
        if (client.url.includes('/order/')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // 2) 若 PWA 完全杀掉进程冷启动，强制打开 /order/ 绝对路径
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

// 5. 网络拦截与离线缓存策略
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
