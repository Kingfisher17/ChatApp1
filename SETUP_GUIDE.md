# Quick Setup Guide

## 📦 Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. iOS Pods (iOS only)
```bash
cd ios && pod install && cd ..
```

### 3. TypeScript Declaration
The file `react-native-sqlite-storage.d.ts` is already created at the root. This fixes TypeScript errors for SQLite.

---

## 🔧 Configuration Files

### Android Permissions
**File:** `android/app/src/main/AndroidManifest.xml`
✅ Already configured with all required permissions

### iOS Permissions
**File:** `ios/MyApp/Info.plist`
✅ Already configured with all required usage descriptions

---

## 🚀 Running the App

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

---

## 📱 Testing Features

1. **Create Conversation**: Tap `+` button on chat list
2. **Send Text**: Type and send
3. **Send Image**: Tap 📎 → 📷 Image → Camera/Gallery
4. **Send Video**: Tap 📎 → 🎥 Video
5. **Record Audio**: Tap 📎 → 🎤 Audio → Hold to record
6. **Send File**: Tap 📎 → 📎 File
7. **Simulate Message**: Tap 💬 button in chat → Select type
8. **Download Media**: Tap "Download" on received media
9. **View Media**: Tap downloaded image/video to view fullscreen

---

## 🗂️ File Structure

```
Documents/
├── images/     # All image files
├── videos/     # All video files
├── audio/      # All audio files
└── files/      # All document files
```

**Database:** `ChatApp.db` (app's private directory)

---

## ⚠️ Common Issues

### TypeScript Error: SQLite
✅ Fixed with `react-native-sqlite-storage.d.ts`

### Permission Denied (Android)
- Check AndroidManifest.xml has all permissions
- Grant permissions in device settings

### Permission Denied (iOS)
- Check Info.plist has all usage descriptions
- Grant permissions when prompted

### File Not Found
- Ensure directories are created (automatic on first use)
- Check file path format (should include `file://` prefix)

---

## 📚 Documentation

- **IMPLEMENTATION.md** - Complete implementation overview
- **CODE_REFERENCE.md** - Full code examples
- **This file** - Quick setup guide

---

## ✅ Dependencies

All required packages are in `package.json`:
- `react-native-sqlite-storage` - Database
- `react-native-fs` - File operations
- `react-native-image-picker` - Image/Video picker
- `react-native-audio-recorder-player` - Audio recording
- `react-native-video` - Video playback

No backend, Firebase, or Redux required! 🎉


