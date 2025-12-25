import {Image} from 'react-native';

/**
 * EXIF Orientation values
 * See: https://www.daveperrett.com/articles/2012/07/28/exif-orientation-handling-is-a-ghetto/
 */
export enum ExifOrientation {
  Normal = 1,
  FlipHorizontal = 2,
  Rotate180 = 3,
  FlipVertical = 4,
  Rotate90FlipHorizontal = 5,
  Rotate270 = 6,
  Rotate90FlipVertical = 7,
  Rotate90 = 8,
}

/**
 * Get EXIF orientation from image
 * Note: React Native Image.getSize doesn't provide EXIF data directly
 * This is a placeholder - actual implementation requires native modules
 */
export const getExifOrientation = async (uri: string): Promise<number> => {
  // TODO: Implement native module to read EXIF orientation
  // For now, return normal orientation
  // In production, you would use a library like:
  // - react-native-image-picker (already provides orientation)
  // - react-native-image-resizer
  // - Custom native module using EXIF libraries
  
  try {
    // Try to get orientation from image picker response if available
    // This is a placeholder - actual implementation needs native code
    return ExifOrientation.Normal;
  } catch (error) {
    console.warn('Failed to get EXIF orientation:', error);
    return ExifOrientation.Normal;
  }
};

/**
 * Calculate rotation needed to correct EXIF orientation
 */
export const getRotationForOrientation = (orientation: number): number => {
  switch (orientation) {
    case ExifOrientation.Normal:
      return 0;
    case ExifOrientation.FlipHorizontal:
      return 0; // Handle with scale transform
    case ExifOrientation.Rotate180:
      return 180;
    case ExifOrientation.FlipVertical:
      return 0; // Handle with scale transform
    case ExifOrientation.Rotate90FlipHorizontal:
      return 90;
    case ExifOrientation.Rotate270:
      return -90;
    case ExifOrientation.Rotate90FlipVertical:
      return 90;
    case ExifOrientation.Rotate90:
      return 90;
    default:
      return 0;
  }
};

/**
 * Calculate scale transform for EXIF orientation
 */
export const getScaleForOrientation = (orientation: number): {scaleX: number; scaleY: number} => {
  switch (orientation) {
    case ExifOrientation.FlipHorizontal:
      return {scaleX: -1, scaleY: 1};
    case ExifOrientation.FlipVertical:
      return {scaleX: 1, scaleY: -1};
    case ExifOrientation.Rotate90FlipHorizontal:
      return {scaleX: -1, scaleY: 1};
    case ExifOrientation.Rotate90FlipVertical:
      return {scaleX: 1, scaleY: -1};
    default:
      return {scaleX: 1, scaleY: 1};
  }
};

/**
 * Swap width and height if orientation requires 90/270 degree rotation
 */
export const getCorrectedDimensions = (
  width: number,
  height: number,
  orientation: number
): {width: number; height: number} => {
  const needsSwap =
    orientation === ExifOrientation.Rotate90 ||
    orientation === ExifOrientation.Rotate270 ||
    orientation === ExifOrientation.Rotate90FlipHorizontal ||
    orientation === ExifOrientation.Rotate90FlipVertical;
  
  return needsSwap ? {width: height, height: width} : {width, height};
};

/**
 * Apply EXIF orientation correction to image dimensions
 */
export const applyExifOrientation = async (
  uri: string,
  onSize: (width: number, height: number, orientation: number) => void
): Promise<void> => {
  try {
    // Get image size
    Image.getSize(
      uri,
      async (width, height) => {
        // Get EXIF orientation
        const orientation = await getExifOrientation(uri);
        
        // Get corrected dimensions
        const corrected = getCorrectedDimensions(width, height, orientation);
        
        // Callback with corrected dimensions and orientation
        onSize(corrected.width, corrected.height, orientation);
      },
      (error) => {
        console.error('Error getting image size:', error);
      }
    );
  } catch (error) {
    console.error('Error applying EXIF orientation:', error);
  }
};


