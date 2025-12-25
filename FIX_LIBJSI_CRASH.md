# Fix libjsi.so Crash Error

## Problem

The app crashes with:
```
java.lang.UnsatisfiedLinkError: dlopen failed: library "libjsi.so" not found
```

This happens because native libraries are not being properly packaged in the APK.

## Solution

### Step 1: Clean Build

```bash
cd android
./gradlew clean
cd ..
```

### Step 2: Clean React Native Cache

```bash
# Clear Metro cache
rm -rf /tmp/metro-*

# Clear watchman
watchman watch-del-all

# Clear node modules (optional but recommended)
rm -rf node_modules
npm install
```

### Step 3: Rebuild App

```bash
# Rebuild Android app
npm run android

# Or manually:
cd android
./gradlew assembleDebug
cd ..
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 4: Verify Native Libraries

After building, check that native libraries are included:

```bash
# Extract and check APK contents
unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep libjsi.so
```

You should see:
```
lib/arm64-v8a/libjsi.so
lib/armeabi-v7a/libjsi.so
lib/x86/libjsi.so
lib/x86_64/libjsi.so
```

## What Was Fixed

Added `packagingOptions` to `android/app/build.gradle` to ensure all native libraries (including `libjsi.so`) are properly included in the APK.

## Alternative: Disable Hermes (Not Recommended)

If the issue persists, you can temporarily disable Hermes:

1. Edit `android/gradle.properties`:
   ```
   hermesEnabled=false
   ```

2. Rebuild:
   ```bash
   cd android && ./gradlew clean && cd ..
   npm run android
   ```

**Note**: This will use JSC instead of Hermes, which is slower and uses more memory.

## Prevention

Always:
1. Clean build when adding new native dependencies
2. Rebuild after updating React Native
3. Check that all native libraries are included in APK

## Verification

After fixing, the app should:
- Launch without crashing
- Connect to Metro bundler
- Load the database
- Display the chat interface

Check logs:
```bash
adb logcat | grep ReactNativeJS
```

You should see:
```
I ReactNativeJS: Running "MyApp" with {"rootTag":11}
I ReactNativeJS: Promise based runtime ready
I ReactNativeJS: OPEN database: ChatApp.db
```

No more `UnsatisfiedLinkError`!


