// Service Worker: מאפשר קבלת Web Push והצגת התראות גם כשהאפליקציה סגורה/ברקע.
// לא עושה caching של האתר - התפקיד היחיד כאן הוא push + notificationclick.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
    let payload = { title: 'NOT10.ai', body: '' };
    if (event.data) {
        try { payload = event.data.json(); } catch { payload.body = event.data.text(); }
    }
    const title = payload.title || 'NOT10.ai';
    const options = {
        body: payload.body || '',
        icon: 'icon.png',
        badge: 'icon.png',
        tag: payload.tag || 'weekwise-push-reminder'
    };
    // actions/data: כפתורי בוצע/עוד-לא ישירות על התראת-המערכת - מגיעים
    // מ-send-due-reminders (שרת) או מ-showBrowserNotification (לקוח, אותו
    // מבנה בדיוק) - ר' notificationclick למטה לטיפול בלחיצה עליהם
    if (payload.actions) options.actions = payload.actions;
    if (payload.data) options.data = payload.data;
    event.waitUntil(self.registration.showNotification(title, options));
});

const MARK_DONE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/mark-reminder-done';

function focusOrOpenApp(path) {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
        const existing = clientsArr.find((c) => 'focus' in c);
        if (existing) {
            if ('navigate' in existing) return existing.navigate(path).then((c) => (c || existing).focus());
            return existing.focus();
        }
        return self.clients.openWindow(path);
    });
}

self.addEventListener('notificationclick', (event) => {
    const data = event.notification.data;
    event.notification.close();

    if (event.action === 'done' && data) {
        // "בוצע" ישירות מהתראת-המערכת - בלי לפתוח את האפליקציה בכלל, ר'
        // mark-reminder-done (אין session כאן בתוך ה-SW, לכן פונקציה נפרדת
        // ללא אימות-משתמשת, סומכת על sourceId כמזהה בלתי-ניחוש שהגיע רק
        // דרך Push חתום-VAPID של השרת שלנו)
        event.waitUntil(
            fetch(MARK_DONE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).catch(() => { /* לא קריטי - המשתמשת עדיין יכולה לסמן ידנית באפליקציה */ })
        );
        return;
    }
    if (event.action === 'not_done') return; // "מאוחר יותר" - רק סוגר, כלום מעבר לזה

    // לחיצה על גוף ההתראה עצמו (לא על כפתור) - פותחת/ממקדת את האפליקציה
    // ישר בהצצה להיום, לא נחיתה כללית על מסך הבית, לפי בקשה מפורשת
    event.waitUntil(focusOrOpenApp('./index.html?open=peek'));
});

// טיפול מפורש בסגירה (למשל לחיצה על ה-X): לא עושה כלום מעבר לסגירה עצמה,
// כדי לוודא שדחיית התראה לעולם לא "מפעילה" שוב משהו בטעות.
self.addEventListener('notificationclose', () => {});
