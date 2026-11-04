/* PWA instalable. Todas las consultas y operaciones requieren conexion; no se cachean sesiones ni datos privados. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* Red por defecto, sin persistencia de datos de usuarios. */ });
