// Personal Hub install lifecycle only. Do not cache protected HTML, API responses,
// authentication pages, or financial data on shared devices.
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
