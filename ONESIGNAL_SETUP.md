# OneSignal Push Notifications Setup Guide

## ✅ What's Been Done

1. **Installed OneSignal SDK** - Added script tag to layout
2. **Created OneSignal helpers** - `src/lib/onesignal.ts`
3. **Created notification service** - `src/lib/notification-service-onesignal.ts`
4. **Created API route** - `src/app/api/send-notification-onesignal/route.ts`
5. **Updated components** - NotificationToggle and booking confirmation

## 🚀 Setup Steps

### Step 1: Create OneSignal Account

1. Go to [OneSignal.com](https://onesignal.com/)
2. Sign up or log in
3. Click **"New App/Website"**
4. Name it **"HostelHQ"**

### Step 2: Configure Web Push

1. Select **"Web Push"** platform
2. Choose **"Typical Site"** setup
3. **Site URL**: `http://localhost:3000` (for dev) or your production URL
4. **Auto Resubscribe**: Enable
5. **Default Notification Icon**: Upload your logo (optional)
6. Click **"Save"**

### Step 3: Get Your Credentials

After setup, you'll see:

- **App ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **REST API Key**: Go to **Settings** → **Keys & IDs**

### Step 4: Add to Environment Variables

Open `.env.local` and replace the placeholder values:

```env
# OneSignal Push Notifications
NEXT_PUBLIC_ONESIGNAL_APP_ID=your-app-id-from-step-3
ONESIGNAL_APP_ID=your-app-id-from-step-3
ONESIGNAL_REST_API_KEY=your-rest-api-key-from-step-3
```

**Example:**
```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=12345678-1234-1234-1234-123456789012
ONESIGNAL_APP_ID=12345678-1234-1234-1234-123456789012
ONESIGNAL_REST_API_KEY=YourRestApiKeyHere
```

### Step 5: Restart Dev Server

```bash
# Stop server
Ctrl + C

# Start again
npm run dev
```

## 🧪 Testing

### 1. Enable Notifications

1. Log in to your app
2. Click your profile → **"Enable Notifications"**
3. Allow browser permission when prompted
4. You should see **"Notifications enabled! 🎉"**

### 2. Test Booking Notification

1. Make a test booking
2. After payment confirmation, you should:
   - See a push notification (if tab is in background)
   - See red badge on notification bell icon
   - See notification in bell dropdown

### 3. Check OneSignal Dashboard

1. Go to OneSignal dashboard
2. Click **"Audience"** → **"All Users"**
3. You should see your user with External User ID (your Firebase UID)
4. Click **"Messages"** → **"Sent"** to see sent notifications

## 📱 How It Works

### User Flow

1. **User enables notifications** → OneSignal creates subscription
2. **OneSignal links to Firebase UID** → External User ID set
3. **Booking created** → API sends notification to user's Firebase UID
4. **OneSignal delivers** → Push notification + stored in Firestore
5. **User sees notification** → Bell icon badge + dropdown list

### Architecture

```
Booking Confirmation
    ↓
notifyBookingConfirmed(userId, hostelName, bookingId)
    ↓
/api/send-notification-onesignal
    ↓
OneSignal REST API (sends push)
    ↓
Firestore (stores notification doc)
    ↓
NotificationBell component (shows in UI)
```

## 🔧 Troubleshooting

### "Missing NEXT_PUBLIC_ONESIGNAL_APP_ID"

- Make sure you added the env vars to `.env.local`
- Restart dev server after adding env vars

### "No notifications received"

1. Check browser console for errors
2. Verify you clicked "Enable Notifications"
3. Check OneSignal dashboard → Audience → verify user exists
4. Check OneSignal dashboard → Messages → verify notification was sent

### "User not found in OneSignal"

- Make sure `setExternalUserId(userId)` was called after enabling notifications
- Check browser console for `[OneSignal] External user ID set: <userId>`

### "Notification sent but not in bell dropdown"

- Check Firestore: `users/{userId}/notifications` collection
- Verify API route is storing notification doc
- Check browser console for errors in NotificationBell component

## 🎯 Next Steps

1. **Add to other flows**:
   - Review approval/rejection
   - Visit scheduling
   - Payment confirmation
   - Admin alerts

2. **Customize notifications**:
   - Add images/icons
   - Add action buttons
   - Customize sounds

3. **Production setup**:
   - Update Site URL in OneSignal to production domain
   - Add production env vars to hosting platform
   - Test on production domain

## 📚 Resources

- [OneSignal Web Push Docs](https://documentation.onesignal.com/docs/web-push-quickstart)
- [OneSignal REST API](https://documentation.onesignal.com/reference/create-notification)
- [OneSignal Dashboard](https://onesignal.com/)

## ✨ Benefits Over Firebase FCM

- ✅ No complex service account setup
- ✅ No server-side credentials needed
- ✅ Better dashboard and analytics
- ✅ Easier to test and debug
- ✅ Built-in user segmentation
- ✅ Scheduled notifications support
- ✅ A/B testing built-in
