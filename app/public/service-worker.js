// Service Worker untuk PWA - DEVELOPMENT MODE (No caching for static files)
const CACHE_NAME = 'floopystream-api-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network only (no caching for development)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // NETWORK ONLY - Always fetch from server, don't cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        // If offline and no cache, return error
        // return new Response('Offline - Network unavailable', {
        //   status: 503,
        //   statusText: 'Service Unavailable',
        //   headers: new Headers({
        //     'Content-Type': 'text/plain'
        //   })
        // });
      })
  );
});
