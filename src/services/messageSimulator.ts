import {Message, MessageType} from '../types';

// Static remote URLs for testing
const SAMPLE_MEDIA_URLS = {
  image: [
    'https://picsum.photos/400/400?random=1',
    'https://picsum.photos/400/400?random=2',
    'https://picsum.photos/400/400?random=3',
  ],
  video: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  ],
  audio: [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  ],
  file: [
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  ],
};

class MessageSimulator {
  private static instance: MessageSimulator;
  private messageCallbacks: Array<(message: Message) => void> = [];

  static getInstance(): MessageSimulator {
    if (!MessageSimulator.instance) {
      MessageSimulator.instance = new MessageSimulator();
    }
    return MessageSimulator.instance;
  }

  subscribe(callback: (message: Omit<Message, 'id'>) => void): () => void {
    this.messageCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notify(message: Omit<Message, 'id'>): void {
    this.messageCallbacks.forEach((callback) => callback(message));
  }

  generateTextMessage(conversationId: number): Omit<Message, 'id'> {
    const texts = [
      'Hello! How are you?',
      'This is a test message',
      'Nice to meet you!',
      'What are you up to?',
      'Thanks for the message!',
    ];
    return {
      conversationId,
      type: 'text',
      text: texts[Math.floor(Math.random() * texts.length)],
      edited: false,
      isSender: false,
      status: 'delivered',
      createdAt: Date.now(),
    };
  }

  generateMediaMessage(
    conversationId: number,
    type: 'image' | 'video' | 'audio' | 'file'
  ): Omit<Message, 'id'> {
    const urls = SAMPLE_MEDIA_URLS[type];
    const url = urls[Math.floor(Math.random() * urls.length)];
    const fileName = this.getFileNameFromUrl(url, type);

    return {
      conversationId,
      type,
      mediaUri: url,
      fileName,
      fileSize: 0, // Will be updated after download
      edited: false,
      isSender: false,
      status: 'delivered',
      createdAt: Date.now(),
    };
  }

  private getFileNameFromUrl(url: string, type: MessageType): string {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const queryIndex = lastPart.indexOf('?');
    const baseName =
      queryIndex > 0 ? lastPart.substring(0, queryIndex) : lastPart;

    if (baseName.includes('.')) {
      return baseName;
    }

    // Default extensions
    const extensions: {[key: string]: string} = {
      image: '.jpg',
      video: '.mp4',
      audio: '.mp3',
      file: '.pdf',
    };

    return `${baseName}${extensions[type] || ''}`;
  }

  simulateReceivedMessage(
    conversationId: number,
    type?: 'text' | 'image' | 'video' | 'audio' | 'file'
  ): void {
    let message: Omit<Message, 'id'>;

    if (type && type !== 'text') {
      message = this.generateMediaMessage(conversationId, type);
    } else {
      message = this.generateTextMessage(conversationId);
    }

    // Simulate delay
    setTimeout(() => {
      this.notify(message);
    }, 500 + Math.random() * 1000);
  }
}

export const messageSimulator = MessageSimulator.getInstance();

