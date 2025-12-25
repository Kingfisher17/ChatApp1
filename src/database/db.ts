import SQLite, {SQLiteDatabase} from 'react-native-sqlite-storage';
import {Message, Conversation, MessageType, MessageStatus} from '../types';

// Disable DEBUG in production to prevent crashes
SQLite.DEBUG(__DEV__);
SQLite.enablePromise(true);

class DatabaseService {
  private db: SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      // Use try-catch for SQLite.openDatabase as it can throw on Android
      this.db = await SQLite.openDatabase({
        name: 'ChatApp.db',
        location: 'default',
      });
      
      if (!this.db) {
        throw new Error('Failed to open database');
      }
      
      await this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      // Don't throw - allow app to continue, database will be retried
      // In production, you might want to show an error screen
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    // Create conversations table
    const createConversationsTable = `
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        lastMessage TEXT,
        updatedAt INTEGER
      );
    `;

    // Create messages table
    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversationId INTEGER,
        type TEXT,
        text TEXT,
        mediaUri TEXT,
        localPath TEXT,
        fileName TEXT,
        fileSize INTEGER,
        edited BOOLEAN,
        isSender BOOLEAN,
        status TEXT,
        createdAt INTEGER
      );
    `;

    // Create index on conversationId for faster queries
    const createMessagesIndex = `
      CREATE INDEX IF NOT EXISTS idx_messages_conversationId 
      ON messages(conversationId);
    `;

    // Create index on updatedAt for conversations
    const createConversationsIndex = `
      CREATE INDEX IF NOT EXISTS idx_conversations_updatedAt 
      ON conversations(updatedAt);
    `;

    await this.db.executeSql(createConversationsTable);
    await this.db.executeSql(createMessagesTable);
    await this.db.executeSql(createMessagesIndex);
    await this.db.executeSql(createConversationsIndex);
  }

  // Conversation methods
  async createConversation(conversation: Omit<Conversation, 'id'>): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const insertQuery = `
      INSERT INTO conversations (name, lastMessage, updatedAt)
      VALUES (?, ?, ?);
    `;

    const [results] = await this.db.executeSql(insertQuery, [
      conversation.name,
      conversation.lastMessage || null,
      conversation.updatedAt,
    ]);

    // Return the generated ID
    return results.insertId;
  }

  async getAllConversations(): Promise<Conversation[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT * FROM conversations ORDER BY updatedAt DESC;'
    );

    const conversations: Conversation[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      conversations.push({
        id: row.id,
        name: row.name,
        lastMessage: row.lastMessage,
        updatedAt: row.updatedAt,
      });
    }

    return conversations;
  }

  async getConversationById(conversationId: number): Promise<Conversation | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT * FROM conversations WHERE id = ?;',
      [conversationId]
    );

    if (results.rows.length === 0) {
      return null;
    }

    const row = results.rows.item(0);
    return {
      id: row.id,
      name: row.name,
      lastMessage: row.lastMessage,
      updatedAt: row.updatedAt,
    };
  }

  async updateConversation(
    conversationId: number,
    updates: Partial<Pick<Conversation, 'name' | 'lastMessage' | 'updatedAt'>>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.lastMessage !== undefined) {
      fields.push('lastMessage = ?');
      values.push(updates.lastMessage);
    }
    if (updates.updatedAt !== undefined) {
      fields.push('updatedAt = ?');
      values.push(updates.updatedAt);
    }

    if (fields.length === 0) return;

    values.push(conversationId);
    const updateQuery = `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?;`;

    await this.db.executeSql(updateQuery, values);
  }

  async deleteConversation(conversationId: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get all messages with localPath before deleting
    const [results] = await this.db.executeSql(
      'SELECT localPath FROM messages WHERE conversationId = ? AND localPath IS NOT NULL;',
      [conversationId]
    );

    const localPaths: string[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const localPath = results.rows.item(i).localPath;
      if (localPath) {
        localPaths.push(localPath);
      }
    }

    // Delete the conversation (messages will be deleted automatically due to CASCADE)
    await this.db.executeSql('DELETE FROM conversations WHERE id = ?;', [
      conversationId,
    ]);

    // Cleanup all associated media files
    for (const localPath of localPaths) {
      await fileManager.deleteMediaFile(localPath);
    }
  }

  // Message methods
  async addMessage(message: Omit<Message, 'id'>): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const insertQuery = `
      INSERT INTO messages (
        conversationId, type, text, mediaUri, localPath,
        fileName, fileSize, edited, isSender, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const [results] = await this.db.executeSql(insertQuery, [
      message.conversationId,
      message.type,
      message.text || null,
      message.mediaUri || null,
      message.localPath || null,
      message.fileName || null,
      message.fileSize || null,
      message.edited ? 1 : 0,
      message.isSender ? 1 : 0,
      message.status,
      message.createdAt,
    ]);

    // Update conversation's lastMessage and updatedAt
    const lastMessageText =
      message.text ||
      (message.type === 'image'
        ? '📷 Image'
        : message.type === 'video'
        ? '🎥 Video'
        : message.type === 'audio'
        ? '🎤 Audio'
        : message.type === 'file'
        ? '📎 File'
        : '');

    await this.updateConversation(message.conversationId, {
      lastMessage: lastMessageText,
      updatedAt: message.createdAt,
    });

    // Return the generated ID
    return results.insertId;
  }

  async getMessagesByConversationId(
    conversationId: number
  ): Promise<Message[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC;',
      [conversationId]
    );

    const messages: Message[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      messages.push({
        id: row.id,
        conversationId: row.conversationId,
        type: row.type as MessageType,
        text: row.text,
        mediaUri: row.mediaUri,
        localPath: row.localPath,
        fileName: row.fileName,
        fileSize: row.fileSize,
        edited: row.edited === 1,
        isSender: row.isSender === 1,
        status: row.status as MessageStatus,
        createdAt: row.createdAt,
      });
    }

    return messages;
  }

  async updateMessageLocalPath(
    messageId: number,
    localPath: string
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql(
      'UPDATE messages SET localPath = ? WHERE id = ?;',
      [localPath, messageId]
    );
  }

  async updateMessageStatus(
    messageId: number,
    status: MessageStatus
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.executeSql('UPDATE messages SET status = ? WHERE id = ?;', [
      status,
      messageId,
    ]);
  }

  async deleteMessage(messageId: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get localPath before deleting
    const [results] = await this.db.executeSql(
      'SELECT localPath FROM messages WHERE id = ?;',
      [messageId]
    );

    let localPath: string | null = null;
    if (results.rows.length > 0) {
      localPath = results.rows.item(0).localPath || null;
    }

    // Delete the message from database
    await this.db.executeSql('DELETE FROM messages WHERE id = ?;', [messageId]);

    // Cleanup associated media file
    if (localPath) {
      await fileManager.deleteMediaFile(localPath);
    }
  }

  async searchMessages(conversationId: number, searchText: string): Promise<Message[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const searchQuery = `
      SELECT * FROM messages 
      WHERE conversationId = ? 
      AND (text LIKE ? OR fileName LIKE ?)
      ORDER BY createdAt ASC;
    `;
    const searchPattern = `%${searchText}%`;

    const [results] = await this.db.executeSql(searchQuery, [
      conversationId,
      searchPattern,
      searchPattern,
    ]);

    const messages: Message[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      messages.push({
        id: row.id,
        conversationId: row.conversationId,
        type: row.type as MessageType,
        text: row.text,
        mediaUri: row.mediaUri,
        localPath: row.localPath,
        fileName: row.fileName,
        fileSize: row.fileSize,
        edited: row.edited === 1,
        isSender: row.isSender === 1,
        status: row.status as MessageStatus,
        createdAt: row.createdAt,
      });
    }
    return messages;
  }

  async getMediaMessages(conversationId: number): Promise<Message[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      `SELECT * FROM messages 
       WHERE conversationId = ? 
       AND type IN ('image', 'video', 'audio', 'file')
       AND localPath IS NOT NULL
       ORDER BY createdAt DESC;`,
      [conversationId]
    );

    const messages: Message[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      messages.push({
        id: row.id,
        conversationId: row.conversationId,
        type: row.type as MessageType,
        text: row.text,
        mediaUri: row.mediaUri,
        localPath: row.localPath,
        fileName: row.fileName,
        fileSize: row.fileSize,
        edited: row.edited === 1,
        isSender: row.isSender === 1,
        status: row.status as MessageStatus,
        createdAt: row.createdAt,
      });
    }
    return messages;
  }

  async clearConversation(conversationId: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get all localPaths before deleting
    const [results] = await this.db.executeSql(
      'SELECT localPath FROM messages WHERE conversationId = ? AND localPath IS NOT NULL;',
      [conversationId]
    );

    const localPaths: string[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      const localPath = results.rows.item(i).localPath;
      if (localPath) {
        localPaths.push(localPath);
      }
    }

    // Delete all messages
    await this.db.executeSql('DELETE FROM messages WHERE conversationId = ?;', [
      conversationId,
    ]);

    // Update conversation
    await this.updateConversation(conversationId, {
      lastMessage: null,
      updatedAt: Date.now(),
    });

    // Cleanup all media files
    for (const localPath of localPaths) {
      await fileManager.deleteMediaFile(localPath);
    }
  }

  async getMessageLocalPath(messageId: number): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const [results] = await this.db.executeSql(
      'SELECT localPath FROM messages WHERE id = ?;',
      [messageId]
    );

    if (results.rows.length === 0) {
      return null;
    }

    return results.rows.item(0).localPath || null;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

export const databaseService = new DatabaseService();

