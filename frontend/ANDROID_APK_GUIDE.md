# IFEELINCOLOR — Android APK Build Guide (Capacitor)

This app uses **Capacitor 7** to package the React PWA as a native Android APK.

## One-time setup (your local machine)
You need these installed locally (NOT required in this preview container):
- Node.js 20+
- Java JDK 21
- Android Studio (latest) — installs the Android SDK & adb
- Android SDK platform-tools

## Build pipeline

```bash
# 1. From /app/frontend  — build production web assets
yarn build

# 2. (One-time) Add the Android platform if /android does not exist yet
npx cap add android

# 3. Sync the latest build into the Android project
npx cap sync android

# 4. Open the project in Android Studio
npx cap open android
```

In Android Studio:
1. Let Gradle sync (first time can take ~5 min).
2. Build → **Generate Signed Bundle / APK…** → choose **APK**.
3. Create a new keystore (or use existing). Save the keystore password securely.
4. Select **release** build variant → finish.
5. Your signed APK appears at `android/app/release/app-release.apk`.

## Configuration

Edit `/app/frontend/capacitor.config.ts`:

- `appId` — `com.ifeelincolor.app` (change to your own reverse-domain ID)
- `appName` — `IFEELINCOLOR`
- `server.url` — Leave commented for fully-offline APK that ships built assets.
  Uncomment & set to your HTTPS URL to make the APK a thin shell over the live web app.

## Quick install on a phone
1. Enable **USB debugging** in Android Developer Options.
2. Plug in via USB.
3. Run: `adb install android/app/release/app-release.apk`.

## Notes
- The PWA already works offline-friendly via React build output.
- Add Capacitor plugins later for native features (camera, push, biometrics): `yarn add @capacitor/camera @capacitor/push-notifications`.
- WebAuthn / fingerprint login already works inside Capacitor 7 WebView on modern Android.
