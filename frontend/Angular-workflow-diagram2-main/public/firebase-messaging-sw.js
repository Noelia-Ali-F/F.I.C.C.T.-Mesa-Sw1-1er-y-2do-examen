importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDkBVnqhY4v3B5i_3vBZNFzF1769eOmbgI",
  authDomain: "parcialsoftware-383c1.firebaseapp.com",
  projectId: "parcialsoftware-383c1",
  storageBucket: "parcialsoftware-383c1.firebasestorage.app",
  messagingSenderId: "443664792242",
  appId: "1:443664792242:web:d3ede4702e181088ab67ab"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);

  if (payload && payload.notification) {
    return;
  }

  const data = payload && payload.data ? payload.data : {};
  const notificationTitle = data.title || (payload.notification && payload.notification.title) || 'Nueva Notificacion';
  const notificationOptions = {
    body: data.body || (payload.notification && payload.notification.body) || '',
    icon: data.icon || '/favicon_io/web-app-manifest-192x192.png',
    badge: data.badge || '/favicon_io/favicon-96x96.png',
    tag: data.codigo ? `workflow-${data.codigo}` : undefined,
    renotify: true,
    data: {
      url: data.url || '/',
      ...data
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
