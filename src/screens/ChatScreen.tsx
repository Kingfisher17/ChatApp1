import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  Image,
  Text,
  Dimensions,
  Alert,
  ListRenderItem,
  ViewToken,
  TextInput,
  ActionSheetIOS,
} from 'react-native';
import Video from 'react-native-video';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import MediaGallery from '../components/MediaGallery';
import {Message, MediaFile, Conversation, MessageStatus} from '../types';
import {databaseService} from '../database/db';
import {fileManager} from '../utils/fileManager';
import {audioService} from '../services/audioService';
import {messageSimulator} from '../services/messageSimulator';

const {width, height} = Dimensions.get('window');

interface ChatScreenProps {
  conversationId: number;
  conversationName: string;
  onBack?: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId,
  conversationName,
  onBack,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]); // For search
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    [messageId: number]: number;
  }>({});
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const [visibleMessageIds, setVisibleMessageIds] = useState<Set<number>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [mediaGalleryVisible, setMediaGalleryVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledToTopRef = useRef(false);

  useEffect(() => {
    loadConversation();
    loadMessages();

    // Subscribe to message simulator
    const unsubscribe = messageSimulator.subscribe((receivedMessage) => {
      if (receivedMessage.conversationId === conversationId) {
        handleReceivedMessage(receivedMessage);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  // Filter messages based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setMessages(allMessages);
    }
  }, [searchQuery, allMessages]);

  const loadConversation = async () => {
    try {
      const conv = await databaseService.getConversationById(conversationId);
      if (conv) {
        setConversation(conv);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const loadedMessages = await databaseService.getMessagesByConversationId(
        conversationId
      );
      // Reverse for inverted FlatList (newest at top)
      const reversedMessages = [...loadedMessages].reverse();
      setAllMessages(reversedMessages);
      setMessages(reversedMessages);
      // Scroll to top (index 0) when using inverted FlatList
      setTimeout(() => {
        if (reversedMessages.length > 0 && !hasScrolledToTopRef.current) {
          flatListRef.current?.scrollToIndex({
            index: 0,
            animated: false,
            viewPosition: 0,
          });
          hasScrolledToTopRef.current = true;
        }
      }, 100);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const performSearch = async (query: string) => {
    try {
      const searchResults = await databaseService.searchMessages(
        conversationId,
        query
      );
      const reversedResults = [...searchResults].reverse();
      setMessages(reversedResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleSendText = useCallback(
    async (text: string) => {
      const tempId = Date.now(); // Temporary ID for optimistic update
      const newMessage: Message = {
        id: tempId,
        conversationId,
        text,
        type: 'text',
        edited: false,
        isSender: true,
        status: 'sending',
        createdAt: Date.now(),
      };

      try {
        // Optimistically add message
        setMessages((prev) => [newMessage, ...prev]);
        setAllMessages((prev) => [newMessage, ...prev]);

        // Save to database and get real ID
        const messageId = await databaseService.addMessage({
          conversationId,
          text,
          type: 'text',
          edited: false,
          isSender: true,
          status: 'sending',
          createdAt: Date.now(),
        });

        // Update status to sent with real ID
        await databaseService.updateMessageStatus(messageId, 'sent');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, id: messageId, status: 'sent'} : msg
          )
        );
        setAllMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, id: messageId, status: 'sent'} : msg
          )
        );

        // Scroll to top (newest message)
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: 0,
            animated: true,
            viewPosition: 0,
          });
        }, 50);
      } catch (error) {
        console.error('Failed to send message:', error);
        // Update status to failed
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, status: 'failed'} : msg
          )
        );
        setAllMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, status: 'failed'} : msg
          )
        );
        Alert.alert('Error', 'Failed to send message. Tap to retry.');
      }
    },
    [conversationId]
  );

  const handleSendMedia = useCallback(
    async (media: MediaFile, type: Message['type']) => {
      const tempId = Date.now(); // Temporary ID for optimistic update
      const localPath = media.uri;
      
      // Check if image is edited (has editMetadata)
      const isEdited = type === 'image' && !!media.editMetadata;

      const newMessage: Message = {
        id: tempId,
        conversationId,
        type,
        mediaUri: media.uri,
        fileName: media.name,
        fileSize: media.size,
        edited: isEdited,
        isSender: true,
        status: 'sending',
        createdAt: Date.now(),
        localPath,
      };

      try {
        // Optimistically add message
        setMessages((prev) => [newMessage, ...prev]);
        setAllMessages((prev) => [newMessage, ...prev]);

        // Save media to permanent location
        // For images: use original/edited directories based on isEdited flag
        // For other types: use default directories
        const permanentLocalPath = await fileManager.saveMediaFile(
          localPath,
          media.name,
          tempId.toString(),
          type,
          isEdited
        );

        // Save to database and get real ID
        const messageId = await databaseService.addMessage({
          conversationId,
          type,
          mediaUri: media.uri,
          fileName: media.name,
          fileSize: media.size,
          edited: isEdited,
          isSender: true,
          status: 'sending',
          createdAt: Date.now(),
          localPath: permanentLocalPath,
        });

        // Update local path in database if different
        if (permanentLocalPath !== localPath) {
          await databaseService.updateMessageLocalPath(messageId, permanentLocalPath);
        }

        // Update status to sent with real ID
        await databaseService.updateMessageStatus(messageId, 'sent');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, id: messageId, localPath: permanentLocalPath, status: 'sent', edited: isEdited} : msg
          )
        );
        setAllMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, id: messageId, localPath: permanentLocalPath, status: 'sent', edited: isEdited} : msg
          )
        );

        // Scroll to top
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: 0,
            animated: true,
            viewPosition: 0,
          });
        }, 50);
      } catch (error) {
        console.error('Failed to send media:', error);
        // Update status to failed
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, status: 'failed'} : msg
          )
        );
        setAllMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? {...msg, status: 'failed'} : msg
          )
        );
        Alert.alert('Error', 'Failed to send media. Tap to retry.');
      }
    },
    [conversationId]
  );

  const handleResendMessage = useCallback(
    async (message: Message) => {
      try {
        // Update status to sending
        await databaseService.updateMessageStatus(message.id, 'sending');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id ? {...msg, status: 'sending'} : msg
          )
        );
        setAllMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id ? {...msg, status: 'sending'} : msg
          )
        );

        // Simulate sending (in real app, this would be API call)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Update status to sent
        await databaseService.updateMessageStatus(message.id, 'sent');
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id ? {...msg, status: 'sent'} : msg
          )
        );
        setAllMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id ? {...msg, status: 'sent'} : msg
          )
        );
      } catch (error) {
        console.error('Failed to resend message:', error);
        await databaseService.updateMessageStatus(message.id, 'failed');
        Alert.alert('Error', 'Failed to resend message');
      }
    },
    []
  );

  const handleReceivedMessage = useCallback(
    async (receivedMessage: Omit<Message, 'id'>) => {
      try {
        const messageId = await databaseService.addMessage(receivedMessage);
        const messageWithId: Message = {
          ...receivedMessage,
          id: messageId,
        };
        setMessages((prev) => [messageWithId, ...prev]);
        setAllMessages((prev) => [messageWithId, ...prev]);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: 0,
            animated: true,
            viewPosition: 0,
          });
        }, 50);
      } catch (error) {
        console.error('Failed to add received message:', error);
      }
    },
    []
  );

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deleteMessage(messageId);
              setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
              setAllMessages((prev) => prev.filter((msg) => msg.id !== messageId));
            } catch (error) {
              console.error('Failed to delete message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  }, []);

  const handleClearChat = useCallback(() => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to delete all messages? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.clearConversation(conversationId);
              setMessages([]);
              setAllMessages([]);
              Alert.alert('Success', 'Chat cleared');
            } catch (error) {
              console.error('Failed to clear chat:', error);
              Alert.alert('Error', 'Failed to clear chat');
            }
          },
        },
      ]
    );
  }, [conversationId]);

  const handleMessageLongPress = useCallback(
    (message: Message) => {
      setSelectedMessageId(message.id);
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Delete', message.status === 'failed' ? 'Resend' : null].filter(
              Boolean
            ) as string[],
            destructiveButtonIndex: 1,
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              handleDeleteMessage(message.id);
            } else if (buttonIndex === 2 && message.status === 'failed') {
              handleResendMessage(message);
            }
            setSelectedMessageId(null);
          }
        );
      } else {
        Alert.alert(
          'Message Options',
          '',
          [
            {text: 'Cancel', style: 'cancel'},
            ...(message.status === 'failed'
              ? [{text: 'Resend', onPress: () => handleResendMessage(message)}]
              : []),
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => handleDeleteMessage(message.id),
            },
          ]
        );
      }
    },
    [handleDeleteMessage, handleResendMessage]
  );

  const handleDownloadMedia = useCallback(async (message: Message) => {
    if (!message.mediaUri || message.localPath) return;

    try {
      const fileName = message.fileName || `media_${message.id}`;
      setDownloadProgress((prev) => ({...prev, [message.id]: 0}));

      const localPath = await fileManager.downloadMediaFile(
        message.mediaUri,
        fileName,
        message.id.toString(),
        message.type,
        (progress) => {
          setDownloadProgress((prev) => ({
            ...prev,
            [message.id]: progress.percentage,
          }));
        }
      );

      await databaseService.updateMessageLocalPath(message.id, localPath);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? {...msg, localPath} : msg
        )
      );
      setAllMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? {...msg, localPath} : msg
        )
      );

      setDownloadProgress((prev) => {
        const updated = {...prev};
        delete updated[message.id];
        return updated;
      });
    } catch (error) {
      console.error('Failed to download media:', error);
      Alert.alert('Error', 'Failed to download media');
      setDownloadProgress((prev) => {
        const updated = {...prev};
        delete updated[message.id];
        return updated;
      });
    }
  }, []);

  const handleAudioPlayPause = useCallback(async (message: Message) => {
    if (message.mediaUri && !message.localPath) {
      Alert.alert('Download Required', 'Please download the media first');
      return;
    }

    try {
      if (playingAudioId === message.id) {
        await audioService.stopAudio();
        setPlayingAudioId(null);
      } else {
        if (playingAudioId) {
          await audioService.stopAudio();
        }
        const audioPath = message.localPath || message.mediaUri;
        if (audioPath) {
          await audioService.playAudio(audioPath);
          setPlayingAudioId(message.id);
          setTimeout(async () => {
            await audioService.stopAudio();
            setPlayingAudioId(null);
          }, 30000);
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
      setPlayingAudioId(null);
    }
  }, [playingAudioId]);

  const handleMediaPress = useCallback(async (message: Message) => {
    if (message.mediaUri && !message.localPath) {
      Alert.alert('Download Required', 'Please download the media first');
      return;
    }

    if (message.type === 'audio') {
      return;
    } else {
      setSelectedMedia(message);
      setMediaModalVisible(true);
    }
  }, []);

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      const visibleIds = new Set<number>();
      viewableItems.forEach((item) => {
        if (item.item) {
          visibleIds.add(item.item.id);
        }
      });
      setVisibleMessageIds(visibleIds);
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current;

  const renderMessage: ListRenderItem<Message> = useCallback(
    ({item}) => {
      const shouldLoadMedia = visibleMessageIds.has(item.id);

      return (
        <MessageBubble
          message={item}
          onMediaPress={handleMediaPress}
          downloadProgress={downloadProgress[item.id]}
          onDownloadPress={handleDownloadMedia}
          isAudioPlaying={playingAudioId === item.id}
          onAudioPlayPause={handleAudioPlayPause}
          shouldLoadMedia={shouldLoadMedia}
          onLongPress={() => handleMessageLongPress(item)}
          onResend={() => handleResendMessage(item)}
        />
      );
    },
    [
      visibleMessageIds,
      downloadProgress,
      playingAudioId,
      handleMediaPress,
      handleDownloadMedia,
      handleAudioPlayPause,
      handleMessageLongPress,
      handleResendMessage,
    ]
  );

  const keyExtractor = useCallback((item: Message) => item.id.toString(), []);

  const renderMediaModal = useMemo(() => {
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
        visible={mediaModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMediaModalVisible(false)}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setMediaModalVisible(false)}>
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
  }, [selectedMedia, mediaModalVisible]);

  const handleSimulateMessage = useCallback(() => {
    Alert.alert(
      'Simulate Message',
      'Choose message type',
      [
        {
          text: 'Text',
          onPress: () =>
            messageSimulator.simulateReceivedMessage(conversationId, 'text'),
        },
        {
          text: 'Image',
          onPress: () =>
            messageSimulator.simulateReceivedMessage(conversationId, 'image'),
        },
        {
          text: 'Video',
          onPress: () =>
            messageSimulator.simulateReceivedMessage(conversationId, 'video'),
        },
        {
          text: 'Audio',
          onPress: () =>
            messageSimulator.simulateReceivedMessage(conversationId, 'audio'),
        },
        {
          text: 'File',
          onPress: () =>
            messageSimulator.simulateReceivedMessage(conversationId, 'file'),
        },
        {text: 'Cancel', style: 'cancel'},
      ]
    );
  }, [conversationId]);

  const showMenuOptions = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Search', 'Media Gallery', 'Clear Chat'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setIsSearching(true);
          } else if (buttonIndex === 2) {
            setMediaGalleryVisible(true);
          } else if (buttonIndex === 3) {
            handleClearChat();
          }
        }
      );
    } else {
      Alert.alert(
        'Options',
        '',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Search', onPress: () => setIsSearching(true)},
          {text: 'Media Gallery', onPress: () => setMediaGalleryVisible(true)},
          {
            text: 'Clear Chat',
            style: 'destructive',
            onPress: handleClearChat,
          },
        ]
      );
    }
  }, [handleClearChat]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {conversationName || conversation?.name || 'Chat'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={showMenuOptions}>
            <Text style={styles.headerButtonText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSearching && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        inverted={true}
        contentContainerStyle={styles.messagesList}
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: 80, // Estimated average item height
          offset: 80 * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: 0,
              animated: true,
            });
          }, 100);
        }}
      />
      <ChatInput onSendText={handleSendText} onSendMedia={handleSendMedia} />
      {renderMediaModal}
      <MediaGallery
        visible={mediaGalleryVisible}
        onClose={() => setMediaGalleryVisible(false)}
        conversationId={conversationId}
        onMediaPress={handleMediaPress}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECE5DD',
  },
  header: {
    backgroundColor: '#075E54',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
  },
  searchCancel: {
    color: '#075E54',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesList: {
    paddingVertical: 8,
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

export default ChatScreen;
