/**
 * WhatsApp-like Chat Application
 * Built with React Native CLI
 *
 * @format
 */

import React, {useState, useRef} from 'react';
import {StatusBar} from 'react-native';
import ChatScreen from './src/screens/ChatScreen';
import ChatListScreen from './src/screens/ChatListScreen';

function App(): React.JSX.Element {
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [currentConversationName, setCurrentConversationName] = useState<
    string | null
  >(null);
  const refreshConversationsRef = useRef<(() => void) | null>(null);

  const handleSelectConversation = (
    conversationId: number,
    conversationName: string
  ) => {
    setCurrentConversationId(conversationId);
    setCurrentConversationName(conversationName);
  };

  const handleBack = () => {
    setCurrentConversationId(null);
    setCurrentConversationName(null);
    // Refresh conversations list when navigating back
    if (refreshConversationsRef.current) {
      setTimeout(() => {
        refreshConversationsRef.current?.();
      }, 100);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#075E54" />
      {currentConversationId && currentConversationName ? (
        <ChatScreen
          conversationId={currentConversationId}
          conversationName={currentConversationName}
          onBack={handleBack}
        />
      ) : (
        <ChatListScreen
          onSelectConversation={handleSelectConversation}
          refreshRef={refreshConversationsRef}
        />
      )}
    </>
  );
}

export default App;
