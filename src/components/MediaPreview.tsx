import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Video from 'react-native-video';
import {MediaFile} from '../types';
import {fileManager} from '../utils/fileManager';

interface MediaPreviewProps {
  media: MediaFile;
  type: 'image' | 'video' | 'audio' | 'file';
  onRemove: () => void;
  onSend: () => void;
  onPlayAudio?: () => void;
  isPlaying?: boolean;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({
  media,
  type,
  onRemove,
  onSend,
  onPlayAudio,
  isPlaying = false,
}) => {

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return '📄';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    if (['ppt', 'pptx'].includes(ext || '')) return '📽️';
    if (['zip', 'rar', '7z'].includes(ext || '')) return '📦';
    return '📎';
  };

  const renderContent = () => {
    const fileUri = media.uri.startsWith('file://')
      ? media.uri
      : `file://${media.uri}`;

    switch (type) {
      case 'image':
        const isEdited = !!media.editMetadata;
        return (
          <View style={styles.imageContainer}>
            <View style={styles.imageThumbnailContainer}>
              <Image source={{uri: fileUri}} style={styles.thumbnail} />
              {isEdited && (
                <View style={styles.editedBadge}>
                  <Text style={styles.editedBadgeText}>✏️</Text>
                </View>
              )}
            </View>
            <View style={styles.imageInfo}>
              <View style={styles.imageNameRow}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {media.name}
                </Text>
                {isEdited && (
                  <Text style={styles.editedLabel}>Edited</Text>
                )}
              </View>
              <Text style={styles.fileSize}>{fileManager.formatFileSize(media.size)}</Text>
            </View>
          </View>
        );

      case 'video':
        return (
          <View style={styles.videoContainer}>
            <Video
              source={{uri: fileUri}}
              style={styles.videoThumbnail}
              paused={true}
              resizeMode="cover"
            />
            <View style={styles.videoPlayOverlay}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {media.name}
              </Text>
              <Text style={styles.fileSize}>{fileManager.formatFileSize(media.size)}</Text>
            </View>
          </View>
        );

      case 'audio':
        return (
          <View style={styles.audioContainer}>
            <TouchableOpacity
              style={styles.audioPlayButton}
              onPress={onPlayAudio}>
              <Text style={styles.audioPlayIcon}>
                {isPlaying ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>
            <View style={styles.audioInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {media.name}
              </Text>
              <Text style={styles.fileSize}>{fileManager.formatFileSize(media.size)}</Text>
              <View style={styles.waveformContainer}>
                <View style={[styles.waveformBar, styles.waveformBar1]} />
                <View style={[styles.waveformBar, styles.waveformBar2]} />
                <View style={[styles.waveformBar, styles.waveformBar3]} />
                <View style={[styles.waveformBar, styles.waveformBar4]} />
                <View style={[styles.waveformBar, styles.waveformBar5]} />
              </View>
            </View>
          </View>
        );

      case 'file':
        return (
          <View style={styles.fileContainer}>
            <Text style={styles.fileIcon}>{getFileIcon(media.name)}</Text>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {media.name}
              </Text>
              <Text style={styles.fileSize}>{fileManager.formatFileSize(media.size)}</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewContent}>{renderContent()}</View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeButtonText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sendButton} onPress={onSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    padding: 12,
  },
  previewContent: {
    marginBottom: 12,
  },
  imageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageThumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  editedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  editedBadgeText: {
    fontSize: 10,
  },
  imageInfo: {
    flex: 1,
  },
  imageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  editedLabel: {
    fontSize: 11,
    color: '#25D366',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  videoContainer: {
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{translateX: -20}, {translateY: -20}],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 2,
  },
  videoInfo: {
    marginTop: 8,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  audioPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioPlayIcon: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  audioInfo: {
    flex: 1,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  waveformBar: {
    width: 4,
    backgroundColor: '#25D366',
    borderRadius: 2,
  },
  waveformBar1: {
    height: 10,
  },
  waveformBar2: {
    height: 20,
  },
  waveformBar3: {
    height: 15,
  },
  waveformBar4: {
    height: 25,
  },
  waveformBar5: {
    height: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  fileIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    color: '#666666',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sendButton: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MediaPreview;

