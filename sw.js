// Service worker de Revelado: recibe los avisos de actividades (push sin contenido) y muestra la notificación.
// El texto se pide al servidor al llegar el aviso, así el mensaje push no necesita cifrado.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let aviso = { titulo: 'Novedades de la fiesta', cuerpo: 'Abre la app para ver el aviso.', url: '/' };
    try {
      const sub = await self.registration.pushManager.getSubscription();
      const r = await fetch('/revelado/api/push/ultimo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub?.endpoint }) });
      if (r.ok) aviso = { ...aviso, ...(await r.json()) };
    } catch { /* sin señal: se muestra el aviso genérico */ }
    await self.registration.showNotification(aviso.titulo, {
      body: aviso.cuerpo, icon: '/revelado/img/icono-192.png', badge: '/revelado/img/icono-192.png',
      tag: 'aviso-fiesta', renotify: true, vibrate: [180, 80, 180], data: { url: aviso.url },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const misma = abiertas.find((c) => new URL(c.url).pathname === new URL(url, self.location.origin).pathname);
    return misma ? misma.focus() : self.clients.openWindow(url);
  })());
});
