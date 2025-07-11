const CACHE_NAME = 'pizzaria-miragem-v1.2';
const STATIC_CACHE = 'static-v1.2';
const DYNAMIC_CACHE = 'dynamic-v1.2';

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/content.html',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js'
];

// Network-first strategy for these routes
const NETWORK_FIRST = [
    '/api/',
    '/contact',
    'https://www.google.com/maps/'
];

// Stale-while-revalidate for these assets
const STALE_WHILE_REVALIDATE = [
    'https://fonts.googleapis.com/',
    'https://fonts.gstatic.com/',
    'https://cdnjs.cloudflare.com/'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            return cacheName !== STATIC_CACHE && 
                                   cacheName !== DYNAMIC_CACHE;
                        })
                        .map(cacheName => {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Network-first strategy for API calls and dynamic content
    if (NETWORK_FIRST.some(pattern => request.url.includes(pattern))) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Stale-while-revalidate for external CDN resources
    if (STALE_WHILE_REVALIDATE.some(pattern => request.url.includes(pattern))) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
    
    // Cache-first strategy for static assets
    event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
    try {
        const cacheResponse = await caches.match(request);
        if (cacheResponse) {
            return cacheResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Cache-first strategy failed:', error);
        
        // Return offline fallback
        if (request.destination === 'document') {
            return caches.match('/index.html');
        }
        
        // Return a simple offline response for other requests
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
}

// Network-first strategy
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Network-first strategy failed:', error);
        
        const cacheResponse = await caches.match(request);
        if (cacheResponse) {
            return cacheResponse;
        }
        
        // Return offline fallback
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const cacheResponse = await caches.match(request);
        
        // Fetch from network in background
        const networkResponsePromise = fetch(request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            })
            .catch(error => {
                console.error('Background fetch failed:', error);
                return null;
            });
        
        // Return cached version immediately, or wait for network
        return cacheResponse || networkResponsePromise;
    } catch (error) {
        console.error('Stale-while-revalidate strategy failed:', error);
        return fetch(request).catch(() => new Response('Offline', { status: 503 }));
    }
}

// Background sync for analytics or other non-critical requests
self.addEventListener('sync', event => {
    if (event.tag === 'analytics') {
        event.waitUntil(sendAnalytics());
    }
});

async function sendAnalytics() {
    // Placeholder for analytics sending logic
    console.log('Sending queued analytics data...');
}

// Push notification handler (for future use)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/images/icon-192.png',
            badge: '/images/badge-72.png',
            data: {
                url: data.url
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

// Error handling
self.addEventListener('error', event => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker unhandled promise rejection:', event.reason);
    event.preventDefault();
});