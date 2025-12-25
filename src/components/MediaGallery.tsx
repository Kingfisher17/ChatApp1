import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  Text,
  Platform,
  Dimensions,
} from 'react-native';
import Video from 'react-native-video';
import {Message} from '../types';

const {width, height} = Dimensions.get('window');
const ITEM_SIZE = (width - 24) / 3; // 3 columns with padding

interface MediaGalleryProps {
  visible: boolean;
  onClose: () => void;
  conversationId: number;
  onMediaPress?: (message: Message) => void;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  visible,
  onClose,
  conversationId,
  onMediaPress,
}) => {
  const [mediaMessages, setMediaMessages] = useState<Message[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      loadMediaMessages();
    }
  }, [visible, conversationId]);

  const loadMediaMessages = async () => {
    try {
      const {databaseService} = await import('../database/db');
      const messages = await databaseService.getMediaMessages(conversationId);
      setMediaMessages(messages);
    } catch (error) {
      console.error('Failed to load media messages:', error);
    }
  };

  const handleMediaPress = (message: Message) => {
    if (message.localPath) {
      setSelectedMedia(message);
      setModalVisible(true);
      onMediaPress?.(message);
    }
  };

  const renderMediaItem = ({item}: {item: Message}) => {
    if (!item.localPath) return null;

    let mediaUri = item.localPath;
    if (
      !mediaUri.startsWith('file://') &&
      !mediaUri.startsWith('http://') &&
      !mediaUri.startsWith('https://')
    ) {
      mediaUri = `file://${mediaUri}`;
    }

    return (
      <TouchableOpacity
        style={styles.mediaItem}
        onPress={() => handleMediaPress(item)}>
        {item.type === 'image' && (
          <Image source={{uri: mediaUri}} style={styles.mediaThumbnail} />
        )}
        {item.type === 'video' && (
          <View style={styles.videoThumbnail}>
            <Video
              source={{uri: mediaUri}}
              style={styles.mediaThumbnail}
              paused={true}
              resizeMode="cover"
            />
            <View style={styles.videoOverlay}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        )}
        {(item.type === 'audio' || item.type === 'file') && (
          <View style={styles.fileThumbnail}>
            <Text style={styles.fileIcon}>
              {item.type === 'audio' ? '🎵' : '📎'}
            </Text>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.fileName || 'File'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderModal = () => {
    if (!selectedMedia || !selectedMedia.localPath) return null;

    let mediaUri = selectedMedia.localPath;
    if (
      !mediaUri.startsWith('file://') &&
      !mediaUri.startsWith('http://') &&
      !mediaUri.startsWith('https://')
    ) {
      mediaUri = `file://${mediaUri}`;
    }

    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedMedia.type === 'image' && (
            <Image source={{uri: mediaUri}} style={styles.modalImage} />
          )}
          {selectedMedia.type === 'video' && (
            <Video
              source={{uri: mediaUri}}
              style={styles.modalVideo}
              controls={true}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Media Gallery</Text>
          <View style={styles.placeholder} />
        </View>
        <FlatList
          data={mediaMessages}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No media files</Text>
            </View>
          }
        />
        {renderModal()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#075E54',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  placeholder: {
    width: 40,
  },
  listContent: {
    padding: 8,
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  fileThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  fileIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  fileName: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalImage: {
    width: width,
    height: height * 0.8,
    resizeMode: 'contain',
  },
  modalVideo: {
    width: width,
    height: height * 0.8,
  },
});

export default MediaGallery;

