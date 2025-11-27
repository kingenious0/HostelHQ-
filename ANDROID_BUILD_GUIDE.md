# HostelHQ Android Build Guide

This guide is for building the HostelHQ Android app on a PC with Android Studio.

## Prerequisites

- **Android Studio** (latest version) - [Download here](https://developer.android.com/studio)
- **Java JDK 17+** (usually bundled with Android Studio)
- Clone/download this repository

## How the App Works

The Android app is a **WebView shell** that loads the live HostelHQ web app from:

```
https://hostelhq.vercel.app
```

This means:
- ✅ **Automatic updates**: Any deployment to Vercel is instantly reflected in the app
- ✅ **No rebuild needed** for web/UI changes
- ✅ Only rebuild APK for: icon changes, splash changes, new native plugins

---

## Step 1: Open Project in Android Studio

1. Open **Android Studio**
2. Click **"Open"** (not "New Project")
3. Navigate to this repo's `android/` folder
4. Select the `android` folder and click **OK**
5. Wait for Gradle sync to complete (may take a few minutes first time)

---

## Step 2: Set App Icon (Optional)

To change the app icon:

1. In Android Studio, expand: `app` → `res`
2. Right-click `res` → **New** → **Image Asset**
3. Choose **"Launcher Icons (Adaptive and Legacy)"**
4. Click the folder icon next to "Path" and select your icon image (1024x1024 PNG recommended)
5. Adjust settings as needed
6. Click **Next** → **Finish**

The icon will be automatically generated for all screen densities.

---

## Step 3: Build Debug APK (For Testing)

1. In Android Studio menu: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete
3. Click **"locate"** in the notification to find the APK
4. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Install on Device:
- Transfer APK to Android phone
- Enable "Install from unknown sources" in phone settings
- Tap the APK to install

---

## Step 4: Build Release APK (For Distribution)

### 4.1 Create a Signing Key (First Time Only)

1. In Android Studio: **Build** → **Generate Signed Bundle / APK**
2. Select **APK** → **Next**
3. Click **"Create new..."** under Key store path
4. Fill in:
   - **Key store path**: Choose a safe location (e.g., `hostelhq-release-key.jks`)
   - **Password**: Create a strong password (SAVE THIS!)
   - **Alias**: `hostelhq`
   - **Key password**: Same or different password
   - **Validity**: 25 years
   - **Certificate info**: Fill in your details
5. Click **OK**

⚠️ **IMPORTANT**: Back up your keystore file and passwords! You need them for all future updates.

### 4.2 Build Signed APK

1. **Build** → **Generate Signed Bundle / APK**
2. Select **APK** → **Next**
3. Select your keystore, enter passwords
4. Select **release** build variant
5. Click **Finish**
6. APK location: `android/app/build/outputs/apk/release/app-release.apk`

---

## Step 5: Distribute the App

### Option A: Direct APK Sharing (Free, No Play Store)
- Share APK via WhatsApp, Telegram, email, or download link
- Users install by enabling "Unknown sources"

### Option B: Google Play Store (Requires $25 one-time fee)
1. Create a [Google Play Console](https://play.google.com/console) account
2. Pay the $25 registration fee
3. Create a new app listing
4. Upload your signed APK or App Bundle
5. Fill in store listing details
6. Submit for review

---

## App Configuration

### Current Settings (in `capacitor.config.ts`):

| Setting | Value |
|---------|-------|
| App ID | `com.hostelhq.app` |
| App Name | `HostelHQ` |
| Web URL | `https://hostelhq.vercel.app` |
| Splash Background | `#0F172A` (dark) |
| Splash Spinner | `#3B82F6` (blue) |
| Status Bar | Dark style |

### To Change Settings:

1. Edit `capacitor.config.ts` in the project root
2. Run `npx cap sync android` (requires Node.js)
3. Rebuild the APK

---

## Troubleshooting

### "Gradle sync failed"
- Make sure you have internet connection
- Try: **File** → **Invalidate Caches / Restart**

### "SDK not found"
- Android Studio will prompt to install missing SDK
- Accept and wait for download

### "App shows blank screen"
- Check internet connection on device
- Verify `https://hostelhq.vercel.app` is accessible
- Check if the Vercel deployment is working

### "App crashes on launch"
- Enable debugging: In `capacitor.config.ts`, set `webContentsDebuggingEnabled: true`
- Rebuild and check Chrome DevTools via `chrome://inspect`

---

## Updating the App

### For Web/UI Changes:
- Just deploy to Vercel as normal
- Users see updates automatically when they open the app
- **No APK rebuild needed**

### For Native Changes (icon, splash, new plugins):
1. Make changes in project
2. Run `npx cap sync android`
3. Rebuild APK in Android Studio
4. Distribute new APK

---

## Files Overview

```
android/
├── app/
│   ├── src/main/
│   │   ├── assets/          # Capacitor config files
│   │   ├── java/            # Native Android code
│   │   ├── res/             # Icons, splash, colors
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── gradle/
├── build.gradle
└── settings.gradle
```

---

## Contact

For issues with the Android build, check:
1. This guide
2. [Capacitor Android Docs](https://capacitorjs.com/docs/android)
3. [Android Studio Help](https://developer.android.com/studio/intro)
