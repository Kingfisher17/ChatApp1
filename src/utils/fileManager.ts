import RNFS from 'react-native-fs';
import {MediaFile, MessageType} from '../types';

type DownloadProgressCallback = (progress: {
  bytesWritten: number;
  totalBytes: number;
  percentage: number;
}) => void;

class FileManager {
  private baseDir: string;
  private imagesDir: string;
  private imagesOriginalDir: string;
  private imagesEditedDir: string;
  private videosDir: string;
  private audioDir: string;
  private filesDir: string;
  private directoriesInitialized: boolean = false;

  constructor() {
    // Don't call async methods in constructor
    // Initialize paths only, directories will be created on first use
    this.baseDir = RNFS.DocumentDirectoryPath;
    this.imagesDir = `${this.baseDir}/images`;
    this.imagesOriginalDir = `${this.imagesDir}/original`;
    this.imagesEditedDir = `${this.imagesDir}/edited`;
    this.videosDir = `${this.baseDir}/videos`;
    this.audioDir = `${this.baseDir}/audio`;
    this.filesDir = `${this.baseDir}/files`;
  }

  private async ensureDirectories(): Promise<void> {
    if (this.directoriesInitialized) {
      return;
    }
    
    try {
      const directories = [
        this.imagesDir,
        this.imagesOriginalDir,
        this.imagesEditedDir,
        this.videosDir,
        this.audioDir,
        this.filesDir,
      ];

      for (const dir of directories) {
        try {
          const dirExists = await RNFS.exists(dir);
          if (!dirExists) {
            await RNFS.mkdir(dir);
          }
        } catch (error) {
          console.error(`Error creating directory ${dir}:`, error);
          // Continue with other directories
        }
      }
      
      this.directoriesInitialized = true;
    } catch (error) {
      console.error('Error ensuring directories:', error);
      // Don't throw - allow app to continue
    }
  }

  private getDirectoryForType(type: MessageType, isEdited: boolean = false): string {
    switch (type) {
      case 'image':
        return isEdited ? this.imagesEditedDir : this.imagesOriginalDir;
      case 'video':
        return this.videosDir;
      case 'audio':
        return this.audioDir;
      case 'file':
        return this.filesDir;
      default:
        return this.filesDir;
    }
  }

  private generateUniqueFileName(
    messageId: string,
    originalFileName: string,
    type: MessageType
  ): string {
    // Use messageId + timestamp to ensure uniqueness
    const timestamp = Date.now();
    const fileExtension = originalFileName.split('.').pop() || '';
    const baseName = originalFileName.replace(/\.[^/.]+$/, '');
    // Sanitize filename to avoid issues
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${messageId}_${timestamp}_${sanitizedName}.${fileExtension}`;
  }

  async saveMediaFile(
    sourceUri: string,
    fileName: string,
    messageId: string,
    type: MessageType,
    isEdited: boolean = false
  ): Promise<string> {
    await this.ensureDirectories();
    const targetDir = this.getDirectoryForType(type, isEdited);
    const uniqueFileName = this.generateUniqueFileName(
      messageId,
      fileName,
      type
    );
    const destinationPath = `${targetDir}/${uniqueFileName}`;

    // Remove file:// prefix if present for copyFile
    const cleanSourceUri = sourceUri.replace('file://', '');
    await RNFS.copyFile(cleanSourceUri, destinationPath);
    return destinationPath;
  }

  /**
   * Save original image (before editing)
   */
  async saveOriginalImage(
    sourceUri: string,
    fileName: string,
    messageId: string
  ): Promise<string> {
    return this.saveMediaFile(sourceUri, fileName, messageId, 'image', false);
  }

  /**
   * Save edited image
   */
  async saveEditedImage(
    sourceUri: string,
    fileName: string,
    messageId: string
  ): Promise<string> {
    return this.saveMediaFile(sourceUri, fileName, messageId, 'image', true);
  }

  async downloadMediaFile(
    remoteUrl: string,
    fileName: string,
    messageId: string,
    type: MessageType,
    onProgress?: DownloadProgressCallback
  ): Promise<string> {
    await this.ensureDirectories();
    // Downloaded images are always original (not edited)
    const targetDir = this.getDirectoryForType(type, false);
    const uniqueFileName = this.generateUniqueFileName(
      messageId,
      fileName,
      type
    );
    const destinationPath = `${targetDir}/${uniqueFileName}`;

    const downloadOptions: RNFS.DownloadFileOptions = {
      fromUrl: remoteUrl,
      toFile: destinationPath,
      progress: (res) => {
        if (onProgress) {
          const percentage =
            res.totalBytes > 0
              ? (res.bytesWritten / res.totalBytes) * 100
              : 0;
          onProgress({
            bytesWritten: res.bytesWritten,
            totalBytes: res.totalBytes,
            percentage,
          });
        }
      },
    };

    const result = await RNFS.downloadFile(downloadOptions).promise;

    if (result.statusCode === 200) {
      return destinationPath;
    } else {
      throw new Error(`Download failed with status code: ${result.statusCode}`);
    }
  }

  async deleteMediaFile(localPath: string): Promise<void> {
    try {
      const exists = await RNFS.exists(localPath);
      if (exists) {
        await RNFS.unlink(localPath);
        console.log(`Deleted media file: ${localPath}`);
      }
    } catch (error) {
      console.error(`Error deleting media file ${localPath}:`, error);
      // Don't throw - cleanup should be best effort
    }
  }

  async deleteMediaFileByPath(localPath: string): Promise<void> {
    return this.deleteMediaFile(localPath);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async browseFiles(): Promise<MediaFile[]> {
    try {
      // Browse common directories
      const directories = [
        RNFS.DocumentDirectoryPath,
        RNFS.DownloadDirectoryPath,
        `${RNFS.ExternalStorageDirectoryPath}/Download`,
      ];

      const files: MediaFile[] = [];

      for (const dir of directories) {
        try {
          const dirExists = await RNFS.exists(dir);
          if (dirExists) {
            const dirFiles = await RNFS.readDir(dir);
            for (const file of dirFiles) {
              if (file.isFile()) {
                const stats = await RNFS.stat(file.path);
                files.push({
                  uri: file.path,
                  name: file.name,
                  type: this.getMimeType(file.name),
                  size: stats.size || 0,
                });
              }
            }
          }
        } catch (error) {
          console.log(`Error reading directory ${dir}:`, error);
        }
      }

      return files;
    } catch (error) {
      console.error('Error browsing files:', error);
      return [];
    }
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: {[key: string]: string} = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      txt: 'text/plain',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

export const fileManager = new FileManager();

