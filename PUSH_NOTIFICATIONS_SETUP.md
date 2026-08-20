# 🔔 Push Notifications Setup Guide for HostelHQ

This guide will help you set up Firebase Cloud Messaging (FCM) for web push notifications.

## 📋 Prerequisites

- Firebase project already set up ✅
- HTTPS enabled (required for service workers) ✅
- Modern browser (Chrome, Firefox, Edge, Safari 16.4+)

---

## 🚀 Setup Steps

### Step 1: Enable Firebase Cloud Messaging

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your HostelHQ project
3. Navigate to **Project Settings** (gear icon) → **Cloud Messaging** tab
4. Under **Web Push certificates**, click **Generate key pair**
5. Copy the generated VAPID key

### Step 2: Add Environment Variables

Add these to your `.env.local` file:

```env
# Firebase Cloud Messaging
NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE
```

**Note:** You already have these from your Firebase config:
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- etc.

### Step 3: Update Service Worker Config

Open `public/firebase-messaging-sw.js` and replace the placeholder values with your actual Firebase config:

```javascript
firebase.initializeApp({
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_ACTUAL_AUTH_DOMAIN",
  projectId: "YOUR_ACTUAL_PROJECT_ID",
  storageBucket: "YOUR_ACTUAL_STORAGE_BUCKET",
  messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
  appId: "YOUR_ACTUAL_APP_ID"
});
```

**Tip:** You can find these values in your `.env.local` file or Firebase Console.

### Step 4: Test Locally

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open browser console and check for:
   - Service worker registration
   - No Firebase messaging errors

3. Click "Enable Notifications" button (will be added to header)
4. Grant permission when prompted
5. Check browser console for FCM token

---

## 🎯 How It Works

### Architecture

```
User Browser
    ↓
[Service Worker] ← Receives push messages
    ↓
[FCM Token] → Stored in Firestore
    ↓
Backend API ← Sends notifications
    ↓
Firebase Cloud Messaging
    ↓
User's Device(s)
```

### Files Created

1. **`public/firebase-messaging-sw.js`**
   - Service worker that handles background notifications
   - Shows notifications when app is closed

2. **`src/lib/firebase.ts`** (updated)
   - Added Firebase Messaging initialization
   - `getMessagingInstance()` helper function

3. **`src/hooks/usePushNotifications.ts`**
   - React hook for managing push notifications
   - Handles permission requests
   - Saves FCM tokens to Firestore

4. **`src/app/api/send-notification/route.ts`**
   - API endpoint to send notifications
   - Uses Firebase Admin SDK
   - Cleans up invalid tokens

5. **`src/lib/notification-service.ts`**
   - Helper functions for common notifications
   - Pre-built for bookings, reviews, payments, etc.

6. **`src/components/NotificationToggle.tsx`**
   - UI component to enable/disable notifications
   - Shows current permission status

---

## 💡 Usage Examples

### Enable Notifications (User Side)

Add the `NotificationToggle` component to your header or settings:

```tsx
import { NotificationToggle } from '@/components/NotificationToggle';

// In your component
<NotificationToggle />
```

### Send Notification (Backend)

```typescript
import { notifyBookingConfirmed } from '@/lib/notification-service';

// When a booking is confirmed
await notifyBookingConfirmed(
  userId: "student123",
  hostelName: "Sunshine Hostel",
  bookingId: "booking456"
);
```

### Custom Notification

```typescript
import { sendNotification } from '@/lib/notification-service';

await sendNotification({
  userId: "user123",
  title: "Custom Title",
  body: "Custom message here",
  url: "/custom-page",
  tag: "custom-tag"
});
```

---

## 🔧 Integration Points

### 1. Booking Confirmation
**File:** `src/app/hostels/[id]/secure/page.tsx`

```typescript
import { notifyBookingConfirmed } from '@/lib/notification-service';

// After successful booking
await notifyBookingConfirmed(userId, hostelName, bookingId);
```

### 2. Review Approval
**File:** `src/app/admin/reviews/page.tsx`

```typescript
import { notifyReviewApproved } from '@/lib/notification-service';

// When admin approves review
await notifyReviewApproved(review.studentId, hostelName);
```

### 3. Flagged Review (Admin Alert)
**File:** `src/app/hostels/[id]/book/rating/page.tsx`

```typescript
import { notifyAdminFlaggedReview } from '@/lib/notification-service';

// When review is flagged for profanity
if (hasBadWords) {
  // Get all admin user IDs
  const admins = await getAdminUsers();
  for (const admin of admins) {
    await notifyAdminFlaggedReview(admin.id, studentName, hostelName);
  }
}
```

### 4. Payment Received
**File:** `src/app/api/payment-webhook/route.ts`

```typescript
import { notifyPaymentReceived } from '@/lib/notification-service';

// When payment is confirmed
await notifyPaymentReceived(userId, amount, hostelName);
```

---

## 🧪 Testing

### Test Notification Manually

1. Get your FCM token from browser console after enabling notifications
2. Use Firebase Console → Cloud Messaging → Send test message
3. Or use the API route:

```bash
curl -X POST http://localhost:8080/api/send-notification \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "title": "Test Notification",
    "body": "This is a test",
    "url": "/"
  }'
```

### Check Token Storage

1. Go to Firestore Console
2. Navigate to: `users/{userId}/fcmTokens`
3. Verify token documents exist

---

## 🌐 Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ Yes | ✅ Yes |
| Firefox | ✅ Yes | ✅ Yes |
| Edge | ✅ Yes | ✅ Yes |
| Safari | ✅ 16.4+ | ✅ 16.4+ (PWA only) |
| Opera | ✅ Yes | ✅ Yes |

**Note:** iOS Safari requires the app to be installed as a PWA (you already have PWA setup!).

---

## 🔒 Security Notes

1. **VAPID Key:** Keep it secret, but it's safe in client-side code (it's meant to be public)
2. **FCM Tokens:** Stored per-user in Firestore with proper security rules
3. **API Route:** Protected by Firebase Admin SDK authentication
4. **Service Worker:** Only works on HTTPS (localhost is exception)

---

## 📱 Mobile App (Capacitor)

For your Android app, FCM works automatically! The same tokens will work for both web and mobile.

Additional setup for native apps:
1. Add `google-services.json` to Android project
2. Enable FCM in Capacitor config
3. Handle notifications in native code

---

## 🐛 Troubleshooting

### "Messaging not supported"
- Check if browser supports notifications
- Ensure HTTPS is enabled
- Try in incognito mode (extensions can block)

### "Failed to get FCM token"
- Verify VAPID key is correct
- Check Firebase Console for any errors
- Ensure service worker is registered

### "Notification permission denied"
- User must manually enable in browser settings
- Can't be programmatically reset
- Guide users to: `chrome://settings/content/notifications`

### Service worker not updating
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear service workers in DevTools → Application → Service Workers
- Unregister and re-register

---

## 📊 Monitoring

### Check Notification Delivery

Firebase Console → Cloud Messaging → Reports shows:
- Messages sent
- Delivery rate
- Open rate
- Errors

### Firestore Queries

```javascript
// Get all users with notifications enabled
const usersWithNotifications = await db.collection('users')
  .where('fcmTokens', '!=', null)
  .get();

// Count total tokens
let totalTokens = 0;
for (const user of usersWithNotifications.docs) {
  const tokens = await user.ref.collection('fcmTokens').get();
  totalTokens += tokens.size;
}
```

---

## 🎉 Next Steps

1. ✅ Complete Firebase setup (add VAPID key)
2. ✅ Update service worker with real config
3. ✅ Add `NotificationToggle` to header/settings
4. ✅ Integrate notification calls in booking flow
5. ✅ Integrate notification calls in review flow
6. ✅ Test on different browsers
7. ✅ Deploy and test in production

---

## 📚 Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

---

**Need help?** Check the browser console for detailed error messages or contact the development team.
