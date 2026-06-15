// DayFlow Service Worker v2 — Web Push VAPID
const CACHE = 'dayflow-v2';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });
self.addEventListener('fetch', () => {}); // online-first, sem cache

// ── Recebe push do servidor (APNs → browser → aqui) ──
// Funciona com tela bloqueada, app fechado, qualquer estado
self.addEventListener('push', e => {
  if(!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title:'DayFlow', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || 'DayFlow', {
      body:   data.body  || '',
      icon:   '/icon-192.png',
      badge:  '/icon-192.png',
      tag:    data.tag   || 'dayflow',
      data:   { url: '/' },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

// ── Clique na notificação: abre/foca o app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      const focused = list.find(c => c.url.includes(self.location.origin));
      if(focused) return focused.focus();
      return clients.openWindow('/');
    })
  );
});

// ── Mensagem do app (fallback quando app está aberto) ──
self.addEventListener('message', e => {
  if(e.data?.type === 'SHOW_NOW'){
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body, icon:'/icon-192.png', badge:'/icon-192.png',
      tag: tag||'dayflow', requireInteraction:false, vibrate:[200,100,200],
    });
  }
});
