import {Image} from 'react-native';
import RNFS from 'react-native-fs';

const MAX_PREVIEW_DIMENSION = 1024; // Max dimension for preview (reduces memory usage)

/**
 * Calculate dimensions for a downscaled preview image
 * Keeps aspect ratio while limiting max dimension
 */
export const calculatePreviewDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxDimension: number = MAX_PREVIEW_DIMENSION
): {width: number; height: number; scale: number} => {
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return {width: originalWidth, height: originalHeight, scale: 1};
  }

  const scale = maxDimension / Math.max(originalWidth, originalHeight);
  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
    scale,
  };
};

/**
 * Get image dimensions efficiently
 */
export const getImageDimensions = (uri: string): Promise<{width: number; height: number}> => {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({width, height}),
      (error) => reject(error)
    );
  });
};

/**
 * Clean up temporary files
 */
export const cleanupTempFiles = async (filePaths: string[]): Promise<void> => {
  for (const path of filePaths) {
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
      }
    } catch (error) {
      console.warn(`Failed to cleanup temp file: ${path}`, error);
    }
  }
};


