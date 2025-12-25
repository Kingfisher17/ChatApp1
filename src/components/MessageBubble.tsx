import React, {memo, useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ImageURISource,
} from 'react-native';
import Video from 'react-native-video';
import {Message} from '../types';
import {formatTime} from '../utils/timeFormatter';
import AudioPlayer from './AudioPlayer';
import {fileManager} from '../utils/fileManager';
import {loadImageEditMetadata, getImageTransformStyle} from '../utils/imageProcessor';

interface MessageBubbleProps {
  message: Message;
  onMediaPress?: (message: Message) => void;
  downloadProgress?: number; // 0-100
  onDownloadPress?: (message: Message) => void;
  isAudioPlaying?: boolean;
  onAudioPlayPause?: (message: Message) => void;
  shouldLoadMedia?: boolean; // For lazy loading
  onLongPress?: () => void;
  onResend?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onMediaPress,
  downloadProgress,
  onDownloadPress,
  isAudioPlaying = false,
  onAudioPlayPause,
  shouldLoadMedia = true,
  onLongPress,
  onResend,
}) => {
  const isSent = message.isSender;
  const bubbleStyle = isSent ? styles.sentBubble : styles.receivedBubble;
  const textStyle = isSent ? styles.sentText : styles.receivedText;
  const containerStyle = isSent ? styles.sentContainer : styles.receivedContainer;
  const [imageTransform, setImageTransform] = useState<any>(null);

  // Load image edit metadata for edited images
  useEffect(() => {
    const loadMetadata = async () => {
      if (message.type === 'image' && message.localPath && message.edited) {
        try {
          const metadata = await loadImageEditMetadata(message.localPath);
          if (metadata && metadata.transform) {
            setImageTransform(getImageTransformStyle(metadata.transform));
          } else {
            setImageTransform(null);
          }
        } catch (error) {
          console.error('Error loading image metadata:', error);
          setImageTransform(null);
        }
      } else {
        setImageTransform(null);
      }
    };
    loadMetadata();
  }, [message.type, message.localPath, message.edited]);

  // Check if media needs to be downloaded (has remote URL but no local path)
  const needsDownload =
    !isSent &&
    message.mediaUri &&
    !message.localPath &&
    (message.mediaUri.startsWith('http://') ||
      message.mediaUri.startsWith('https://'));
  const isDownloading = downloadProgress !== undefined && downloadProgress < 100;


  const getStatusIcon = (): string => {
    if (!isSent) return '';
    switch (message.status) {
      case 'sending':
        return '⏳';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓'; // Blue ticks (UI only, shown as double check)
      case 'failed':
        return '✕';
      default:
        return '';
    }
  };


  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return '📄';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    if (['ppt', 'pptx'].includes(ext || '')) return '📽️';
    if (['zip', 'rar', '7z'].includes(ext || '')) return '📦';
    return '📎';
  };

  const renderMedia = () => {
    if (!message.mediaUri && !message.localPath) return null;

    const hasLocalFile = !!message.localPath;
    const mediaUri = message.localPath || message.mediaUri;
    // Ensure proper file URI format for React Native
    let fileUri = mediaUri;
    if (
      !mediaUri.startsWith('file://') &&
      !mediaUri.startsWith('http://') &&
      !mediaUri.startsWith('https://')
    ) {
      fileUri = `file://${mediaUri}`;
    }

    // Show download UI for remote media
    if (needsDownload && !hasLocalFile) {
      return (
        <View style={styles.downloadContainer}>
          {isDownloading ? (
            <>
              <ActivityIndicator size="small" color="#25D366" />
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {width: `${downloadProgress || 0}%`},
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(downloadProgress || 0)}%
              </Text>
            </>
          ) : (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => onDownloadPress?.(message)}>
              <Text style={styles.downloadButtonText}>⬇ Download</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    switch (message.type) {
      case 'image':
        const isEdited = message.edited === true;
        // Memory-safe image source with caching
        const imageSource = {
          uri: fileUri,
          cache: 'force-cache' as const, // Enable image caching
        };
        return (
          <TouchableOpacity
            onPress={() => onMediaPress?.(message)}
            activeOpacity={0.8}
            style={styles.mediaImageContainer}>
            <View style={imageTransform ? [styles.imageTransformContainer, imageTransform] : styles.imageTransformContainer}>
              {shouldLoadMedia ? (
                <Image 
                  source={imageSource} 
                  style={styles.mediaImage}
                  resizeMode="cover"
                  progressiveRenderingEnabled={true}
                  fadeDuration={200}
                  onLoadStart={() => {
                    // Image loading started
                  }}
                  onLoadEnd={() => {
                    // Image loaded successfully
                  }}
                  onError={(error) => {
                    console.error('Image load error:', error);
                  }}
                />
              ) : (
                <View style={[styles.mediaImage, styles.imagePlaceholder]}>
                  <ActivityIndicator size="small" color="#999" />
                </View>
              )}
              {isEdited && (
                <View style={styles.editedIndicator}>
                  <Text style={styles.editedIndicatorText}>✏️ Edited</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );

      case 'video':
        return (
          <TouchableOpacity
            onPress={() => onMediaPress?.(message)}
            activeOpacity={0.8}
            style={styles.videoContainer}>
            <Video
              source={{uri: fileUri}}
              style={styles.mediaVideo}
              paused={true}
              resizeMode="cover"
            />
            <View style={styles.videoPlayOverlay}>
              <View style={styles.videoPlayButton}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </View>
          </TouchableOpacity>
        );

      case 'audio':
        return (
          <AudioPlayer
            isPlaying={isAudioPlaying}
            fileName={message.fileName}
            onPlayPause={() => onAudioPlayPause?.(message)}
            textStyle={textStyle}
          />
        );

      case 'file':
        return (
          <View style={styles.fileCard}>
            <View style={styles.fileIconContainer}>
              <Text style={styles.fileIcon}>{getFileIcon(message.fileName || 'file')}</Text>
            </View>
            <View style={styles.fileInfo}>
              <Text style={[textStyle, styles.fileName]} numberOfLines={1}>
                {message.fileName || 'File'}
              </Text>
              {message.fileSize && (
                <Text style={[textStyle, styles.fileSize]}>
                  {fileManager.formatFileSize(message.fileSize)}
                </Text>
              )}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const handleLongPress = () => {
    if (message.status === 'failed' && onResend) {
      onResend();
    } else if (onLongPress) {
      onLongPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onLongPress={handleLongPress}
      activeOpacity={0.7}>
      <View style={[styles.bubble, bubbleStyle]}>
        {message.type !== 'text' && renderMedia()}
        {message.text && (
          <Text style={[styles.text, textStyle]}>{message.text}</Text>
        )}
        <View style={styles.footer}>
          <Text style={[styles.timestamp, textStyle]}>
            {formatTime(message.createdAt)}
          </Text>
          {isSent && (
            <Text
              style={[
                styles.statusIcon,
                message.status === 'read' && styles.statusIconRead,
                message.status === 'failed' && styles.statusIconFailed,
              ]}>
              {getStatusIcon()}
            </Text>
          )}
        </View>
      </View>
      {message.status === 'failed' && message.isSender && (
        <TouchableOpacity
          style={styles.resendButton}
          onPress={onResend}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Text style={styles.resendText}>↻ Retry</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
    maxWidth: '75%',
  },
  sentContainer: {
    alignSelf: 'flex-end',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    padding: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sentBubble: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  sentText: {
    color: '#000000',
  },
  receivedText: {
    color: '#000000',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
  },
  statusIcon: {
    fontSize: 14,
    color: '#999999',
  },
  statusIconRead: {
    color: '#4FC3F7', // Blue for read status
  },
  statusIconFailed: {
    color: '#FF4444', // Red for failed status
  },
  // Media styles
  mediaImageContainer: {
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageTransformContainer: {
    width: 250,
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: 250,
    height: 250,
    borderRadius: 8,
  },
  editedIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editedIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  videoContainer: {
    width: 250,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  mediaVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  videoPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 3,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    minWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIcon: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
    opacity: 0.7,
  },
  downloadContainer: {
    width: 250,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    padding: 12,
  },
  downloadButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#25D366',
    borderRadius: 2,
  },
  progressText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666666',
  },
  mediaPlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 40,
    opacity: 0.5,
  },
  imagePlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendButton: {
    alignSelf: 'flex-end',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FF4444',
    borderRadius: 12,
  },
  resendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

// Memoize component to prevent unnecessary re-renders
export default memo(MessageBubble, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.localPath === nextProps.message.localPath &&
    prevProps.message.mediaUri === nextProps.message.mediaUri &&
    prevProps.downloadProgress === nextProps.downloadProgress &&
    prevProps.isAudioPlaying === nextProps.isAudioPlaying &&
    prevProps.shouldLoadMedia === nextProps.shouldLoadMedia
  );
});
