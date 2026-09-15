importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// 升至 v20，强制浏览器刷新激活新的 Service Worker 规则
const CACHE_NAME = 'grc-cafe-v20';
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
    return; // 避免前后台双重弹窗
  }

  const notificationTitle = (payload.data && payload.data.title) ? payload.data.title : 'GRC CAFE 提醒';
  
  // 确保通知中附带的跳转目标网址始终准确指向 /order/ 路径
  const targetUrl = (payload.data && payload.data.url) ? payload.data.url : self.registration.scope;

  const notificationOptions = {
    body: (payload.data && payload.data.body) ? payload.data.body : '本周新菜单上线啦，快来预订吧！',
    icon: 'logo-192.png',
    tag: 'grc-cafe-notification',
    renotify: true,
    data: {
      url: targetUrl
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. 点击通知处理：锁定精准子目录，防止退回主域名
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // 确保 scope 结尾带有斜杠 (即 https://grc-cafe.github.io/order/)
  let scopeUrl = self.registration.scope;
  if (!scopeUrl.endsWith('/')) {
    scopeUrl += '/';
  }

  // 获取 Payload 里的自定义目标 URL，若无则默认精准回退到 /order/ 作用域
  let rawUrl = event.notification.data?.url || event.notification.click_action || scopeUrl;
  let targetUrl;

  try {
    targetUrl = new URL(rawUrl, scopeUrl).href;
  } catch (err) {
    targetUrl = scopeUrl;
  }

  // 安全拦截：如果解析出来的 URL 丢失了 /order/ 目录，强行校正回 https://grc-cafe.github.io/order/
  if (!targetUrl.includes('/order/')) {
    targetUrl = scopeUrl;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // 匹配当前已打开的 PWA 页面
      for (let client of windowClients) {
        if (client.url.includes('/order/')) {
          if ('navigate' in client && client.url !== targetUrl) {
            await client.navigate(targetUrl);
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }

      // 如果 PWA 完全关闭，唤起并直接打开精准的 /order/ 页面
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

  // 过滤第三方 API，避免被静态 Cache 拦截
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
