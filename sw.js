// Service Worker: מאפשר קבלת Web Push והצגת התראות גם כשהאפליקציה סגורה/ברקע.
// לא עושה caching של האתר - התפקיד היחיד כאן הוא push + notificationclick.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
    let payload = { title: 'MyWeek', body: '' };
    if (event.data) {
        try { payload = event.data.json(); } catch { payload.body = event.data.text(); }
    }
    const title = payload.title || 'MyWeek';
    const options = {
        body: payload.body || '',
        icon: 'icon.png',
        badge: 'icon.png',
        tag: payload.tag || 'weekwise-push-reminder'
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
            const existing = clientsArr.find((c) => 'focus' in c);
            if (existing) return existing.focus();
            return self.clients.openWindow('./index.html');
        })
    );
});
