# WhatsApp-like Chat App - Complete Implementation Guide

## 📁 Project Structure

```
src/
├── database/
│   └── db.ts                    # SQLite database service
├── screens/
│   ├── ChatListScreen.tsx       # Conversations list
│   └── ChatScreen.tsx           # Chat interface
├── components/
│   ├── MessageBubble.tsx        # Message display component
│   ├── MediaPreview.tsx         # Media preview before sending
│   ├── AudioPlayer.tsx          # Audio playback component
│   └── AttachmentMenu.tsx        # Attachment menu helper
├── utils/
│   ├── fileManager.ts           # File operations & storage
│   └── timeFormatter.ts        # Time formatting utilities
├── services/
│   ├── audioService.ts          # Audio recording/playback
│   └── messageSimulator.ts     # Message simulation
└── types/
    └── index.ts                 # TypeScript types
```

---

## 🗄️ SQLite Database Setup

### Database Schema

**File: `src/database/db.ts`**

```typescript
// Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lastMessage TEXT,
  updatedAt INTEGER NOT NULL
);

// Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'text' | 'image' | 'video' | 'audio' | 'file'
  text TEXT,
  mediaUri TEXT,                   -- Remote URL or local path
  localPath TEXT,                  -- Local file path after download
  fileName TEXT,
  fileSize INTEGER,
  isSender INTEGER NOT NULL,       -- 0 or 1 (BOOLEAN)
  status TEXT NOT NULL,            -- 'sent' | 'delivered' | 'read'
  createdAt INTEGER NOT NULL,
  FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
);

// Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages(conversationId);
CREATE INDEX IF NOT EXISTS idx_conversations_updatedAt ON conversations(updatedAt);
```

### Key Database Operations

**Initialize Database:**
```typescript
await databaseService.initialize();
```

**Create Conversation:**
```typescript
await databaseService.createConversation({
  id: 'conv_123',
  name: 'John Doe',
  updatedAt: Date.now()
});
```

**Add Message:**
```typescript
await databaseService.addMessage({
  id: 'msg_123',
  conversationId: 'conv_123',
  type: 'text',
  text: 'Hello!',
  isSender: true,
  status: 'sent',
  createdAt: Date.now()
});
```

**Get Messages:**
```typescript
const messages = await databaseService.getMessagesByConversationId('conv_123');
```

**Delete Message (with cleanup):**
```typescript
// Automatically deletes associated media file
await databaseService.deleteMessage('msg_123');
```

---

## 📸 Media Picker & File Save Logic

### File Manager (`src/utils/fileManager.ts`)

**Directory Structure:**
- `/Documents/images` - Image files
- `/Documents/videos` - Video files
- `/Documents/audio` - Audio files
- `/Documents/files` - Document files

**Save Media File:**
```typescript
const localPath = await fileManager.saveMediaFile(
  sourceUri,      // Source file URI
  fileName,       // Original filename
  messageId,      // Unique message ID
  type            // 'image' | 'video' | 'audio' | 'file'
);
// Returns: /Documents/images/msg_123_1234567890_image.jpg
```

**Download Media File:**
```typescript
const localPath = await fileManager.downloadMediaFile(
  remoteUrl,      // https://example.com/image.jpg
  fileName,       // image.jpg
  messageId,      // msg_123
  type,           // 'image'
  (progress) => { // Progress callback
    console.log(`${progress.percentage}%`);
  }
);
```

**Unique File Naming:**
- Format: `{messageId}_{timestamp}_{sanitizedName}.{extension}`
- Prevents duplicate filenames
- Example: `msg_123_1703123456789_photo.jpg`

---

## 🎤 Media Picker Implementation

### Image Picker (`src/components/ChatInput.tsx`)

**Camera:**
```typescript
import {launchCamera, MediaType} from 'react-native-image-picker';

launchCamera({
  mediaType: 'photo' as MediaType,
  quality: 0.8,
}, (response) => {
  if (response.assets && response.assets[0]) {
    const asset = response.assets[0];
    // Handle image
  }
});
```

**Gallery:**
```typescript
launchImageLibrary({
  mediaType: 'photo' as MediaType,
  quality: 0.8,
}, (response) => {
  // Handle selection
});
```

**Video:**
```typescript
launchImageLibrary({
  mediaType: 'video' as MediaType,
  quality: 0.8,
}, (response) => {
  // Handle video
});
```

### Audio Recording (`src/services/audioService.ts`)

**Start Recording:**
```typescript
const path = await audioService.startRecording();
// Returns: /Documents/audio_1234567890.m4a
```

**Stop Recording:**
```typescript
const recordingPath = await audioService.stopRecording();
```

**Play Audio:**
```typescript
await audioService.playAudio(localPath);
```

---

## 📥 Download Simulation Logic

### Message Simulator (`src/services/messageSimulator.ts`)

**Static Remote URLs:**
```typescript
const SAMPLE_MEDIA_URLS = {
  image: [
    'https://picsum.photos/400/400?random=1',
    'https://picsum.photos/400/400?random=2',
  ],
  video: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  ],
  audio: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  ],
  file: [
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  ],
};
```

**Simulate Received Message:**
```typescript
// Subscribe to messages
const unsubscribe = messageSimulator.subscribe((message) => {
  // Handle received message
});

// Simulate message
messageSimulator.simulateReceivedMessage(conversationId, 'image');
```

**Download Flow:**
1. Message appears with remote URL
2. User taps "Download" button
3. Progress bar shows download percentage
4. File saved to appropriate directory
5. SQLite updated with `localPath`
6. Media becomes tappable/playable

---

## 📱 Android & iOS Compatibility

### Android Configuration

**File: `android/app/src/main/AndroidManifest.xml`**

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

**Notes:**
- `READ_MEDIA_*` permissions required for Android 13+
- `WRITE_EXTERNAL_STORAGE` may not be needed on Android 10+
- SQLite location: `default` (app's private database directory)

### iOS Configuration

**File: `ios/MyApp/Info.plist`**

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for chat messages</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to select images and videos for chat messages</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>We need access to save photos to your library</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need access to your microphone to record audio for chat messages</string>
```

**Notes:**
- All permission descriptions are required
- SQLite location: `default` (app's Documents directory)
- File paths use `file://` prefix for React Native

### Platform-Specific Considerations

**File Paths:**
```typescript
// iOS: file:///var/mobile/Containers/Data/Application/.../Documents/images/
// Android: file:///data/user/0/com.myapp/files/Documents/images/
```

**Keyboard Handling:**
```typescript
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
>
```

**SQLite:**
- Works identically on both platforms
- Database file: `ChatApp.db`
- Location: App's private directory

---

## 🔧 Key Implementation Details

### 1. Inverted FlatList
```typescript
<FlatList
  inverted={true}
  data={messages}  // Reversed array (newest first)
  renderItem={renderMessage}
  // Scroll to index 0 for newest message
/>
```

### 2. Lazy Loading Media
```typescript
// Track visible items
const [visibleMessageIds, setVisibleMessageIds] = useState<Set<string>>();

// Only load media for visible messages
<MessageBubble
  shouldLoadMedia={visibleMessageIds.has(message.id)}
/>
```

### 3. File Cleanup
```typescript
// Automatic cleanup on message deletion
async deleteMessage(messageId: string) {
  const localPath = await getMessageLocalPath(messageId);
  await this.db.executeSql('DELETE FROM messages WHERE id = ?;', [messageId]);
  if (localPath) {
    await fileManager.deleteMediaFile(localPath);
  }
}
```

### 4. Performance Optimizations
- `React.memo` for MessageBubble
- `useCallback` for event handlers
- `useMemo` for computed values
- `removeClippedSubviews={true}`
- Lazy media loading

---

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. iOS Setup
```bash
cd ios && pod install && cd ..
```

### 3. Run App
```bash
# Android
npm run android

# iOS
npm run ios
```

### 4. TypeScript Declaration
Create `react-native-sqlite-storage.d.ts` at root:
```typescript
declare module 'react-native-sqlite-storage' {
  export interface SQLiteDatabase { ... }
  const SQLite: SQLiteStatic;
  export default SQLite;
}
```

---

## 📝 Complete Code Files

All implementation files are located in:
- `src/database/db.ts` - Complete SQLite implementation
- `src/utils/fileManager.ts` - File operations
- `src/screens/ChatScreen.tsx` - Main chat interface
- `src/components/MessageBubble.tsx` - Message rendering
- `src/services/messageSimulator.ts` - Download simulation

---

## ✅ Features Summary

- ✅ Text messaging
- ✅ Image upload (camera/gallery)
- ✅ Video upload
- ✅ Audio recording & playback
- ✅ File selection
- ✅ Media download with progress
- ✅ Local file storage (organized by type)
- ✅ SQLite offline storage
- ✅ Automatic file cleanup
- ✅ WhatsApp-like UI
- ✅ Optimized performance


