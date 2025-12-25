import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
} from 'react-native';
import {launchImageLibrary, launchCamera, MediaType} from 'react-native-image-picker';
import {audioService} from '../services/audioService';
import {fileManager} from '../utils/fileManager';
import {MediaFile} from '../types';
import RNFS from 'react-native-fs';
import MediaPreview from './MediaPreview';
import FilePicker from './FilePicker';
import ImageEditorScreen from '../screens/ImageEditorScreen';
import {showAttachmentMenu} from './AttachmentMenu';

interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendMedia: (media: MediaFile, type: 'image' | 'audio' | 'video' | 'file') => void;
}

const ChatInput: React.FC<ChatInputProps> = ({onSendText, onSendMedia}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{
    media: MediaFile;
    type: 'image' | 'video' | 'audio' | 'file';
  } | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [filePickerVisible, setFilePickerVisible] = useState(false);
  const [imageEditorVisible, setImageEditorVisible] = useState(false);
  const [imageEditorSourceUri, setImageEditorSourceUri] = useState<string | null>(null);
  const recordingStartTime = useRef<number>(0);
  const audioPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (audioPathRef.current) {
        audioService.stopAudio().catch(console.error);
      }
    };
  }, []);

  const handleSend = () => {
    if (text.trim()) {
      onSendText(text.trim());
      setText('');
    }
  };

  const handleSendPreview = async () => {
    if (!previewMedia) return;

    try {
      let mediaToSend: MediaFile;
      
      // Check if image is edited (has editMetadata)
      const isEdited = previewMedia.type === 'image' && !!previewMedia.media.editMetadata;
      
      // Check if image is already saved locally (from editor)
      // Edited images are saved in /Documents/images/edited/ directory
      if (previewMedia.type === 'image' && previewMedia.media.uri.includes('/images/edited/')) {
        // Edited image is already saved in app storage
        // Remove file:// prefix if present for consistency
        const localPath = previewMedia.media.uri.replace('file://', '');
        mediaToSend = {
          ...previewMedia.media,
          uri: localPath,
        };
      } else if (previewMedia.type === 'image' && !isEdited) {
        // Original image - save to original directory
        const tempMessageId = `temp_${Date.now()}`;
        const localPath = await fileManager.saveOriginalImage(
          previewMedia.media.uri,
          previewMedia.media.name,
          tempMessageId
        );

        // Update media URI to local path
        mediaToSend = {
          ...previewMedia.media,
          uri: localPath,
        };
      } else {
        // Other media types (video, audio, file) - use default save
        const tempMessageId = `temp_${Date.now()}`;
        const localPath = await fileManager.saveMediaFile(
          previewMedia.media.uri,
          previewMedia.media.name,
          tempMessageId,
          previewMedia.type,
          false // Not edited for non-image types
        );

        // Update media URI to local path
        mediaToSend = {
          ...previewMedia.media,
          uri: localPath,
        };
      }

      onSendMedia(mediaToSend, previewMedia.type);
      setPreviewMedia(null);
      setIsRecording(false);
      audioPathRef.current = null;
    } catch (error) {
      console.error('Error saving media:', error);
      Alert.alert('Error', 'Failed to prepare media for sending');
    }
  };

  const handleRemovePreview = () => {
    setPreviewMedia(null);
    setIsRecording(false);
    if (audioPathRef.current) {
      audioService.stopAudio().catch(console.error);
      audioPathRef.current = null;
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => {
            launchCamera(
              {
                mediaType: 'photo' as MediaType,
                quality: 0.9,
                includeBase64: false,
              },
              (response) => {
                if (response.assets && response.assets[0] && response.assets[0].uri) {
                  setImageEditorSourceUri(response.assets[0].uri);
                  setImageEditorVisible(true);
                }
              }
            );
          },
        },
        {
          text: 'Gallery',
          onPress: () => {
            launchImageLibrary(
              {
                mediaType: 'photo' as MediaType,
                quality: 0.9,
                includeBase64: false,
              },
              (response) => {
                if (response.assets && response.assets[0] && response.assets[0].uri) {
                  setImageEditorSourceUri(response.assets[0].uri);
                  setImageEditorVisible(true);
                }
              }
            );
          },
        },
        {text: 'Cancel', style: 'cancel'},
      ]
    );
  };

  const handleImageEditorSave = (media: MediaFile) => {
    setPreviewMedia({
      media,
      type: 'image',
    });
  };

  const handleVideoPicker = () => {
    launchImageLibrary(
      {
        mediaType: 'video' as MediaType,
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setPreviewMedia({
            media: {
              uri: asset.uri || '',
              name: asset.fileName || 'video.mp4',
              type: asset.type || 'video/mp4',
              size: asset.fileSize || 0,
            },
            type: 'video',
          });
        }
      }
    );
  };

  const handleAudioRecord = async () => {
    if (isRecording) {
      // Stop recording
      try {
        const recordingPath = await audioService.stopRecording();
        const stats = await RNFS.stat(recordingPath);
        audioPathRef.current = recordingPath;

        setPreviewMedia({
          media: {
            uri: recordingPath,
            name: `audio_${Date.now()}.m4a`,
            type: 'audio/m4a',
            size: stats.size || 0,
          },
          type: 'audio',
        });
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping recording:', error);
        Alert.alert('Error', 'Failed to stop recording');
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        await audioService.startRecording();
        setIsRecording(true);
        recordingStartTime.current = Date.now();
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
      }
    }
  };

  const handlePlayAudio = async () => {
    if (!previewMedia || previewMedia.type !== 'audio') return;

    try {
      if (isPlayingAudio) {
        await audioService.stopAudio();
        setIsPlayingAudio(false);
      } else {
        await audioService.playAudio(previewMedia.media.uri);
        setIsPlayingAudio(true);
        // Stop after duration (simplified - in real app, listen to playback events)
        setTimeout(async () => {
          await audioService.stopAudio();
          setIsPlayingAudio(false);
        }, 30000); // 30 seconds max
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const handleFileSelect = (file: MediaFile) => {
    setPreviewMedia({
      media: file,
      type: 'file',
    });
  };

  const handleAttachmentPress = () => {
    if (isRecording) {
      // If recording, stop and show preview
      handleAudioRecord();
    } else {
      showAttachmentMenu({
        onSelectImage: handleImagePicker,
        onSelectVideo: handleVideoPicker,
        onSelectAudio: handleAudioRecord,
        onSelectFile: () => setFilePickerVisible(true),
      });
    }
  };

  return (
    <>
      {previewMedia && (
        <MediaPreview
          media={previewMedia.media}
          type={previewMedia.type}
          onRemove={handleRemovePreview}
          onSend={handleSendPreview}
          onPlayAudio={previewMedia.type === 'audio' ? handlePlayAudio : undefined}
          isPlaying={isPlayingAudio}
        />
      )}
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.attachmentButton, isRecording && styles.recordingButton]}
          onPress={handleAttachmentPress}>
          <Text style={styles.attachmentIcon}>
            {isRecording ? '🔴' : '📎'}
          </Text>
        </TouchableOpacity>
        {isRecording && (
          <Text style={styles.recordingText}>Recording...</Text>
        )}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}>
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
      <FilePicker
        visible={filePickerVisible}
        onClose={() => setFilePickerVisible(false)}
        onSelectFile={handleFileSelect}
      />
      <ImageEditorScreen
        visible={imageEditorVisible}
        onClose={() => {
          setImageEditorVisible(false);
          setImageEditorSourceUri(null);
        }}
        onSave={handleImageEditorSave}
        sourceUri={imageEditorSourceUri}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0F0F0',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  attachmentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  attachmentIcon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordingButton: {
    backgroundColor: '#FF4444',
  },
  recordingText: {
    position: 'absolute',
    top: -20,
    left: 12,
    fontSize: 12,
    color: '#FF4444',
    fontWeight: 'bold',
  },
});

export default ChatInput;
