// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// These values will be replaced at runtime from environment variables
firebase.initializeApp({
  apiKey: "AIzaSyBckeM4BOa9CjPHvCiYVzgXE4f6rKM4sjY",
  authDomain: "studio-9467663896-23071.firebaseapp.com",
  projectId: "studio-9467663896-23071",
  storageBucket: "studio-9467663896-23071.firebasestorage.app",
  messagingSenderId: "144671681113",
  appId: "1:144671681113:web:0a3b5f05281ddb0a8f5f48"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'HostelHQ Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/hostelhq-icon-new.png',
    badge: '/hostelhq-icon-new.png',
    tag: payload.data?.tag || 'hostelhq-notification',
    data: payload.data,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event);
  
  event.notification.close();
  
  // Get the URL to open from notification data
  const urlToOpen = event.notification.data?.url || '/';
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
