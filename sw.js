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
    // מ-send-due-reminders (השרת שולח רק כשהאפליקציה לא פתוחה מול העיניים,
    // וכל תזכורת פעם אחת) - ר' notificationclick למטה לטיפול בלחיצה עליהם
    if (payload.actions) options.actions = payload.actions;
    if (payload.data) options.data = payload.data;
    // תזכורת חזקה יותר (לפי בקשה מפורשת): רטט בטלפונים שתומכים, ותזכורת למשימה נשארת על המסך
    // עד שמגיבים (בוצע / עוד לא / החלקה) במקום להיעלם לבד. הצליל עצמו הוא צליל ההתראות של הטלפון
    options.vibrate = [400, 150, 400, 150, 700];
    options.silent = false;
    if (payload.data && payload.data.sourceType) options.requireInteraction = true;
    // נודניק: אותו tag כמו ההתראה הקודמת - renotify כדי שתצלצל/תרטוט שוב ולא תוחלף בשקט
    if (payload.renotify && options.tag) options.renotify = true;
    const work = [self.registration.showNotification(title, options)];
    // אם האפליקציה פתוחה - מציגים בה גם את פופאפ התזכורת (עם "בוצע" / "עוד לא" / "הבנתי")
    if (payload.data && payload.data.snooze) {
        work.push(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            list.forEach((c) => c.postMessage({ type: 'weekwise-reminder-snooze', data: payload.data }));
        }));
    }
    event.waitUntil(Promise.all(work));
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

// פעולה על תזכורת בלי לפתוח את האפליקציה - ר' mark-reminder-done (אין session כאן בתוך
// ה-SW, לכן פונקציה נפרדת ללא אימות, שסומכת על sourceId כמזהה בלתי-ניחוש שהגיע רק דרך
// Push חתום-VAPID של השרת שלנו). action: done / snooze / dismiss
function reminderAction(data, action) {
    if (!data || !data.sourceType || !data.sourceId) return Promise.resolve();
    return fetch(MARK_DONE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action }),
    }).catch(() => { /* לא קריטי - אפשר עדיין לסמן ידנית באפליקציה */ });
}

self.addEventListener('notificationclick', (event) => {
    const data = event.notification.data;
    event.notification.close();

    if (event.action === 'done' && data) {
        event.waitUntil(reminderAction(data, 'done'));
        return;
    }
    // "⏰ עוד לא" = נודניק: עוד התראה בעוד 5 דקות (וחוזר עד "בוצע" / "הבנתי") - לפי בקשה
    // מפורשת; קודם הכפתור רק סגר את ההתראה ולא עשה כלום
    if (event.action === 'not_done' && data) {
        event.waitUntil(reminderAction(data, 'snooze'));
        return;
    }

    // לחיצה על גוף ההתראה עצמו (לא על כפתור) - ראו את התזכורת, אז מפסיקים נודניק, ופותחים/
    // ממקדים את האפליקציה ישר בהצצה להיום (לפי בקשה מפורשת).
    // תזכורת ארוחה של New Me (data.open = 'newme') פותחת ישר את התפריט של היום
    const target = data && data.open === 'newme' ? 'newme' : 'peek';
    event.waitUntil(Promise.all([reminderAction(data, 'dismiss'), focusOrOpenApp(`./index.html?open=${target}`)]));
});

// סגירת ההתראה (החלקה הצידה / X) = "הבנתי" - לא להזכיר שוב (מבטל נודניק אם היה)
self.addEventListener('notificationclose', (event) => {
    event.waitUntil(reminderAction(event.notification.data, 'dismiss'));
});
