import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import {Conversation} from '../types';
import {databaseService} from '../database/db';
import {formatConversationTime} from '../utils/timeFormatter';

interface ChatListScreenProps {
  onSelectConversation: (conversationId: number, conversationName: string) => void;
  refreshRef?: React.MutableRefObject<(() => void) | null>;
}

const ChatListScreen: React.FC<ChatListScreenProps> = ({
  onSelectConversation,
  refreshRef,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showNewConversationInput, setShowNewConversationInput] = useState(false);
  const [newConversationName, setNewConversationName] = useState('');

  useEffect(() => {
    initializeDatabase();
    loadConversations();
    
    // Expose refresh function via ref
    if (refreshRef) {
      refreshRef.current = loadConversations;
    }
    
    return () => {
      if (refreshRef) {
        refreshRef.current = null;
      }
    };
  }, [refreshRef]);

  const initializeDatabase = async () => {
    try {
      await databaseService.initialize();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // Show user-friendly error instead of crashing
      Alert.alert(
        'Database Error',
        'Failed to initialize database. Please restart the app.',
        [{text: 'OK'}]
      );
    }
  };

  const loadConversations = async () => {
    try {
      const loadedConversations = await databaseService.getAllConversations();
      setConversations(loadedConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const handleCreateConversation = async () => {
    if (!newConversationName.trim()) {
      Alert.alert('Error', 'Please enter a conversation name');
      return;
    }

    try {
      const conversationId = await databaseService.createConversation({
        name: newConversationName.trim(),
        updatedAt: Date.now(),
      });
      setNewConversationName('');
      setShowNewConversationInput(false);
      loadConversations();
      // Automatically open the new conversation
      onSelectConversation(conversationId, newConversationName.trim());
    } catch (error) {
      console.error('Failed to create conversation:', error);
      Alert.alert('Error', 'Failed to create conversation');
    }
  };

  const renderConversation = ({item}: {item: Conversation}) => {
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => onSelectConversation(item.id, item.name)}>
        <View style={styles.conversationAvatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{item.name}</Text>
            <Text style={styles.conversationTime}>
              {formatConversationTime(item.updatedAt)}
            </Text>
          </View>
          <Text style={styles.conversationLastMessage} numberOfLines={1}>
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WhatsApp</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => setShowNewConversationInput(true)}>
          <Text style={styles.newChatButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {showNewConversationInput && (
        <View style={styles.newConversationContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter conversation name"
            value={newConversationName}
            onChangeText={setNewConversationName}
            autoFocus
          />
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateConversation}>
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowNewConversationInput(false);
              setNewConversationName('');
            }}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#075E54',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  newChatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  newConversationContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#CCCCCC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  conversationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999999',
  },
  conversationLastMessage: {
    fontSize: 14,
    color: '#666666',
  },
});

export default ChatListScreen;

