// DayFlow Service Worker
// Necessário para notificações no iOS (PWA adicionado à tela inicial)

const CACHE = 'dayflow-v1';

// ── Install: não cacheia nada obrigatório (app é online-first) ──
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// ── Fetch: passa direto (sem cache agressivo) ──
self.addEventListener('fetch', e => {
  // Deixa o browser lidar normalmente
});

// ── Push notification recebida (futuro: push server-side) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'DayFlow', {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'dayflow',
      data: data.url || '/',
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  );
});

// ── Clique na notificação: abre o app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow(e.notification.data || '/');
    })
  );
});

// ── Notificação agendada via postMessage (disparada pelo app) ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, tag } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: tag || 'task',
        requireInteraction: false,
        vibrate: [200, 100, 200],
      });
    }, delay);
  }
});
