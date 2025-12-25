export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  id: number;
  name: string;
  lastMessage?: string;
  updatedAt: number;
}

export interface Message {
  id: number;
  conversationId: number;
  type: MessageType;
  text?: string;
  mediaUri?: string;
  localPath?: string;
  fileName?: string;
  fileSize?: number;
  edited: boolean;
  isSender: boolean;
  status: MessageStatus;
  createdAt: number;
}

export type CropAspectRatio = 'free' | '1:1' | '4:5' | '16:9';

export interface DrawingPath {
  id: string;
  points: Array<{x: number; y: number}>;
  color: string;
  strokeWidth: number;
}

export interface TextSticker {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily?: string;
  rotation?: number;
  scale?: number;
}

export interface EditorState {
  rotation: number;
  scale: number;
  translateX: number;
  translateY: number;
  cropWidth: number;
  cropHeight: number;
  brightness: number;
  contrast: number;
  saturation: number;
  drawings: DrawingPath[];
  textStickers: TextSticker[];
}

export interface MediaFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  editMetadata?: {
    rotation?: number;
    scale?: number;
    translateX?: number;
    translateY?: number;
    crop?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    aspectRatio?: CropAspectRatio;
    brightness?: number; // -100 to 100
    contrast?: number; // -100 to 100
    saturation?: number; // -100 to 100
    drawings?: DrawingPath[];
    textStickers?: TextSticker[];
    exifOrientation?: number;
  };
}

