/**
 * Native image cropping utility
 * Since React Native doesn't have a package for programmatic image cropping with coordinates,
 * we use ViewShot as a reliable solution that captures exactly what's displayed.
 * 
 * Note: For true native pixel-level cropping, you would need to create a custom native module
 * using Android's Bitmap and iOS's Core Graphics. This ViewShot approach works correctly
 * when transforms are properly applied.
 */

import RNFS from 'react-native-fs';
import {Image} from 'react-native';

/**
 * Calculate the scale factor from image dimensions to display dimensions
 * Used to properly position ViewShot for accurate capture
 */
export const calculateDisplayScale = (
  imageWidth: number,
  imageHeight: number,
  displayWidth: number,
  displayHeight: number,
  scale: number
): {
  scaleX: number;
  scaleY: number;
  displayImageWidth: number;
  displayImageHeight: number;
} => {
  const displayImageWidth = imageWidth * scale;
  const displayImageHeight = imageHeight * scale;
  
  // Scale factors for converting between image space and display space
  const scaleX = displayImageWidth / imageWidth;
  const scaleY = displayImageHeight / imageHeight;
  
  return {
    scaleX,
    scaleY,
    displayImageWidth,
    displayImageHeight,
  };
};

/**
 * Note: True native cropping would require:
 * - Android: Using Bitmap.createBitmap() with crop coordinates
 * - iOS: Using CGImageCreateWithImageInRect() with crop coordinates
 * 
 * This would be implemented in a custom native module.
 * For now, ViewShot provides accurate results when transforms are correctly applied.
 */


