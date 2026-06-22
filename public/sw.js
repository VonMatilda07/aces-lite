// public/sw.js
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('Received push notification:', payload);
      
      const title = payload.title || 'Pesanan Baru!';
      const options = {
        body: payload.body || 'Ada pesanan masuk untuk stasiun Anda.',
        icon: payload.icon || '/icon.png',
        badge: payload.badge || '/icon.png',
        vibrate: payload.vibrate || [200, 100, 200],
        data: payload.data || { url: '/login' },
        tag: payload.tag || 'aces-order-alert',
        renotify: true
      };
      
      event.waitUntil(
        self.registration.showNotification(title, options)
      );
    } catch (e) {
      console.error('Error parsing push data:', e);
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('Pesanan Baru!', {
          body: text,
          icon: '/icon.png',
          vibrate: [200, 100, 200]
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  let targetUrl = '/login';
  if (event.notification.data && event.notification.data.url) {
    targetUrl = event.notification.data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        const clientPath = new URL(client.url).pathname;
        if (clientPath.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
