// ElderShield Service Worker
// Provides offline functionality, push notifications, and background sync

const CACHE_NAME = 'eldershield-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/offline.html',
  '/emergency-offline.html'
];

// API endpoints to cache for offline
const API_CACHE_URLS = [
  '/api/auth/profile',
  '/api/emergency/contacts'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('ElderShield SW: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ElderShield SW: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  console.log('ElderShield SW: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('ElderShield SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Handle offline functionality
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle page requests
  if (request.mode === 'navigate') {
    event.respondWith(handlePageRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with cache-first strategy for specific endpoints
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Critical endpoints that should work offline
  const offlineEndpoints = [
    '/api/auth/profile',
    '/api/emergency/contacts',
    '/api/medications'
  ];

  const shouldCache = offlineEndpoints.some(endpoint => url.pathname.includes(endpoint));

  if (shouldCache && request.method === 'GET') {
    try {
      // Try network first, fallback to cache
      const networkResponse = await fetch(request.clone());
      
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
        return networkResponse;
      }
    } catch (error) {
      console.log('ElderShield SW: Network failed, trying cache...');
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
  }

  // For non-cached API requests, try network only
  try {
    return await fetch(request);
  } catch (error) {
    // Return offline response for failed API calls
    return new Response(
      JSON.stringify({ 
        error: 'Offline mode', 
        message: 'This feature requires internet connection',
        offline: true 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle page requests
async function handlePageRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      return networkResponse;
    }
  } catch (error) {
    console.log('ElderShield SW: Page request failed, serving offline page');
  }

  // Serve offline page
  const cache = await caches.open(CACHE_NAME);
  const offlineResponse = await cache.match(OFFLINE_URL);
  
  if (offlineResponse) {
    return offlineResponse;
  }

  // Fallback offline HTML
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ElderShield - Offline</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 40px; 
          background: #f0f4f8;
          font-size: 1.2rem;
        }
        .emergency-btn { 
          background: #dc2626; 
          color: white; 
          padding: 20px 40px; 
          border: none; 
          border-radius: 10px; 
          font-size: 1.5rem; 
          margin: 20px;
          min-width: 200px;
          min-height: 80px;
          cursor: pointer;
        }
        .offline-icon { font-size: 4rem; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="offline-icon">🛡️</div>
      <h1>ElderShield - Offline Mode</h1>
      <p>You are currently offline. Emergency features are still available.</p>
      
      <button class="emergency-btn" onclick="window.location.href='tel:911'">
        🚨 Emergency Call 911
      </button>
      
      <button class="emergency-btn" onclick="tryReconnect()">
        🔄 Try to Reconnect
      </button>
      
      <script>
        function tryReconnect() {
          if (navigator.onLine) {
            window.location.reload();
          } else {
            alert('Still offline. Please check your internet connection.');
          }
        }
        
        // Auto-retry connection every 30 seconds
        setInterval(() => {
          if (navigator.onLine) {
            window.location.reload();
          }
        }, 30000);
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle static asset requests
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('ElderShield SW: Static asset request failed');
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Push Notification Handling
self.addEventListener('push', event => {
  console.log('ElderShield SW: Push notification received');
  
  const options = {
    badge: '/logo192.png',
    icon: '/logo192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: 'seniorcare-notification'
  };

  let title = 'ElderShield';
  let body = 'You have a new notification';

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      
      // Customize based on notification type
      if (data.type === 'medication_reminder') {
        options.icon = '/medication-icon.png';
        options.badge = '/medication-icon.png';
        options.tag = 'medication-reminder';
        options.actions = [
          {
            action: 'taken',
            title: '✅ Taken',
            icon: '/check-icon.png'
          },
          {
            action: 'snooze',
            title: '⏰ Remind Later',
            icon: '/snooze-icon.png'
          }
        ];
      } else if (data.type === 'emergency_alert') {
        options.icon = '/emergency-icon.png';
        options.badge = '/emergency-icon.png';
        options.tag = 'emergency-alert';
        options.vibrate = [500, 200, 500, 200, 500];
        options.requireInteraction = true;
        options.silent = false;
      } else if (data.type === 'family_message') {
        options.icon = '/family-icon.png';
        options.badge = '/family-icon.png';
        options.tag = 'family-message';
        options.actions = [
          {
            action: 'reply',
            title: '💬 Reply',
            icon: '/reply-icon.png'
          },
          {
            action: 'call',
            title: '📞 Call',
            icon: '/call-icon.png'
          }
        ];
      }
      
      // Add data for click handling
      options.data = data;
    } catch (error) {
      console.error('ElderShield SW: Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handling
self.addEventListener('notificationclick', event => {
  console.log('ElderShield SW: Notification clicked');
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // Handle action buttons
  if (action === 'taken') {
    // Mark medication as taken
    event.waitUntil(
      fetch('/api/medications/mark-taken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId: data.medicationId })
      }).catch(error => console.error('Failed to mark medication taken:', error))
    );
    return;
  }

  if (action === 'snooze') {
    // Snooze medication reminder
    event.waitUntil(
      self.registration.showNotification('Medication Reminder', {
        body: 'Reminder snoozed for 30 minutes',
        icon: '/medication-icon.png',
        tag: 'medication-reminder-snoozed'
      })
    );
    return;
  }

  if (action === 'reply') {
    // Open app to reply page
    event.waitUntil(
      clients.openWindow('/messages?reply=' + (data.messageId || ''))
    );
    return;
  }

  if (action === 'call') {
    // Initiate call (if supported)
    if (data.phoneNumber) {
      event.waitUntil(
        clients.openWindow('tel:' + data.phoneNumber)
      );
    }
    return;
  }

  // Default click behavior - open app
  const urlToOpen = data.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        
        // Otherwise open new window
        return clients.openWindow(urlToOpen);
      })
  );
});

// Background Sync for offline actions
self.addEventListener('sync', event => {
  console.log('ElderShield SW: Background sync triggered');
  
  if (event.tag === 'background-sync-emergency') {
    event.waitUntil(syncEmergencyData());
  } else if (event.tag === 'background-sync-checkins') {
    event.waitUntil(syncCheckInData());
  } else if (event.tag === 'background-sync-medications') {
    event.waitUntil(syncMedicationData());
  }
});

async function syncEmergencyData() {
  try {
    // Sync any pending emergency alerts stored locally
    const pendingAlerts = await getStoredData('pendingEmergencyAlerts');
    
    for (const alert of pendingAlerts) {
      await fetch('/api/emergency/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
      });
    }
    
    // Clear synced data
    await clearStoredData('pendingEmergencyAlerts');
    console.log('ElderShield SW: Emergency data synced');
  } catch (error) {
    console.error('ElderShield SW: Failed to sync emergency data:', error);
  }
}

async function syncCheckInData() {
  try {
    // Sync pending check-ins
    const pendingCheckIns = await getStoredData('pendingCheckIns');
    
    for (const checkIn of pendingCheckIns) {
      await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkIn)
      });
    }
    
    await clearStoredData('pendingCheckIns');
    console.log('ElderShield SW: Check-in data synced');
  } catch (error) {
    console.error('ElderShield SW: Failed to sync check-in data:', error);
  }
}

async function syncMedicationData() {
  try {
    // Sync medication logs
    const pendingMedLogs = await getStoredData('pendingMedicationLogs');
    
    for (const log of pendingMedLogs) {
      await fetch('/api/medications/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      });
    }
    
    await clearStoredData('pendingMedicationLogs');
    console.log('ElderShield SW: Medication data synced');
  } catch (error) {
    console.error('ElderShield SW: Failed to sync medication data:', error);
  }
}

// Helper functions for IndexedDB storage
async function getStoredData(storeName) {
  return new Promise((resolve) => {
    const request = indexedDB.open('SeniorCareOfflineDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getRequest = store.getAll();
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result || []);
      };
      
      getRequest.onerror = () => {
        resolve([]);
      };
    };
    
    request.onerror = () => {
      resolve([]);
    };
  });
}

async function clearStoredData(storeName) {
  return new Promise((resolve) => {
    const request = indexedDB.open('SeniorCareOfflineDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      store.clear();
      resolve();
    };
    
    request.onerror = () => {
      resolve();
    };
  });
}

// Message handling for communication with main app
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_NAME });
      break;
      
    case 'STORE_OFFLINE_DATA':
      storeOfflineData(data.storeName, data.data);
      break;
      
    case 'REGISTER_BACKGROUND_SYNC':
      self.registration.sync.register(data.tag);
      break;
      
    default:
      console.log('SeniorCare Hub SW: Unknown message type:', type);
  }
});

function storeOfflineData(storeName, data) {
  const request = indexedDB.open('SeniorCareOfflineDB', 1);
  
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
    }
  };
  
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    store.add(data);
  };
}

console.log('SeniorCare Hub Service Worker loaded successfully');