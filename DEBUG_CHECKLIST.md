# Android Crash Debugging Checklist

## Step-by-Step Debugging with ADB Logcat

### 1. Connect Device and Enable USB Debugging
```bash
# Check if device is connected
adb devices

# If device not found, enable USB debugging on device:
# Settings > Developer Options > USB Debugging
```

### 2. Clear Previous Logs and Monitor
```bash
# Clear logcat buffer
adb logcat -c

# Monitor all logs (most verbose)
adb logcat *:E *:W *:I

# Or filter for React Native and your app
adb logcat | grep -E "ReactNative|MyApp|AndroidRuntime|FATAL"
```

### 3. Launch App and Capture Crash
```bash
# Launch app
adb shell am start -n com.myapp/.MainActivity

# Immediately capture crash logs
adb logcat -d > crash_log.txt
```

### 4. Common Crash Patterns to Look For

#### SQLite Crash
```
Look for: "SQLiteException", "database", "openDatabase"
Fix: Check database initialization timing
```

#### Permission Crash
```
Look for: "SecurityException", "Permission denied"
Fix: Check AndroidManifest.xml permissions
```

#### Native Module Crash
```
Look for: "UnsatisfiedLinkError", "SoLoader", "native method"
Fix: Check native module linking
```

#### File System Crash
```
Look for: "FileNotFoundException", "ENOENT", "mkdir"
Fix: Check file system initialization
```

### 5. Specific Error Patterns

#### Error: "Unable to load script"
```bash
# Check Metro bundler is running
adb reverse tcp:8081 tcp:8081

# Restart Metro with cache clear
npm start -- --reset-cache
```

#### Error: "SoLoader.init failed"
```bash
# Check MainApplication.kt has SoLoader.init
# Should be in onCreate() method
```

#### Error: "Database locked" or "SQLiteException"
```bash
# Check if database is being accessed from multiple threads
# Ensure single database instance
```

### 6. Runtime Permission Issues (Android 12+)
```bash
# Check if permissions are granted
adb shell dumpsys package com.myapp | grep permission

# Grant permissions manually for testing
adb shell pm grant com.myapp android.permission.CAMERA
adb shell pm grant com.myapp android.permission.RECORD_AUDIO
```

### 7. Check Native Module Linking
```bash
# List all native libraries
adb shell run-as com.myapp ls -la /data/data/com.myapp/lib/

# Should see:
# libreactnativejni.so
# libsqlite.so (or similar)
# libreactnativefs.so
# etc.
```

### 8. Memory Issues
```bash
# Check memory usage
adb shell dumpsys meminfo com.myapp

# Look for high memory usage or OOM errors
```

### 9. Hermes Engine Issues
```bash
# Check if Hermes is enabled
adb shell getprop debug.hermes.enabled

# Check Hermes logs
adb logcat | grep -i hermes
```

### 10. Build Configuration Issues
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run android

# Check for build errors
./gradlew assembleDebug --stacktrace
```

## Quick Fix Commands

```bash
# Full clean rebuild
rm -rf node_modules
npm install
cd android && ./gradlew clean && cd ..
npm run android

# Clear app data on device
adb shell pm clear com.myapp

# Reinstall app
adb uninstall com.myapp
npm run android

# Check app logs in real-time
adb logcat -s ReactNativeJS:V ReactNative:V AndroidRuntime:E
```

## Most Common Causes

1. **FileManager constructor calling async method** ✅ FIXED
2. **SQLite DEBUG mode in production** ✅ FIXED
3. **Missing Android 12+ permission handling** ✅ FIXED
4. **Database initialization without error handling** ✅ FIXED
5. **Native module not properly linked** - Check autolinking
6. **Hermes compatibility issues** - Check gradle.properties

## Verification Steps

After applying fixes:

1. ✅ FileManager no longer calls async in constructor
2. ✅ SQLite DEBUG only in dev mode
3. ✅ Database initialization has error handling
4. ✅ AndroidManifest has proper permissions
5. ✅ ProGuard rules added for native modules

Run these to verify:
```bash
# Build and install
npm run android

# Check logs for errors
adb logcat | grep -E "Error|Exception|FATAL"
```


