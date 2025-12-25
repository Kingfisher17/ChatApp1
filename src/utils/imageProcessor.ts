import RNFS from 'react-native-fs';
import {Image, Platform} from 'react-native';

interface CropParams {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TransformParams {
  rotation: number;
  scale: number;
  translateX: number;
  translateY: number;
}

interface FilterParams {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
}

interface ImageEditMetadata {
  originalUri: string;
  crop?: CropParams;
  transform?: TransformParams;
  filters?: FilterParams;
}

/**
 * Calculate crop coordinates relative to image dimensions
 * Converts screen space crop area to image pixel coordinates
 */
export const calculateCropCoordinates = (
  imageSize: {width: number; height: number},
  displaySize: {width: number; height: number},
  cropArea: CropParams,
  transform: TransformParams
): CropParams => {
  // Calculate how the image is displayed (accounting for scale and translation)
  const scaledWidth = imageSize.width * transform.scale;
  const scaledHeight = imageSize.height * transform.scale;
  
  // Calculate image position in display (centered + translation)
  const imageDisplayX = (displaySize.width - scaledWidth) / 2 + transform.translateX;
  const imageDisplayY = (displaySize.height - scaledHeight) / 2 + transform.translateY;
  
  // Calculate crop area relative to image (accounting for rotation)
  // First, convert crop area from screen space to image space before rotation
  let cropX = (cropArea.x - imageDisplayX) / transform.scale;
  let cropY = (cropArea.y - imageDisplayY) / transform.scale;
  let cropWidth = cropArea.width / transform.scale;
  let cropHeight = cropArea.height / transform.scale;
  
  // Account for rotation - rotate crop coordinates around image center
  if (transform.rotation !== 0) {
    const centerX = imageSize.width / 2;
    const centerY = imageSize.height / 2;
    const radians = (-transform.rotation * Math.PI) / 180; // Negative for counter-clockwise
    
    // Rotate crop corner points
    const corners = [
      {x: cropX, y: cropY},
      {x: cropX + cropWidth, y: cropY},
      {x: cropX, y: cropY + cropHeight},
      {x: cropX + cropWidth, y: cropY + cropHeight},
    ];
    
    const rotatedCorners = corners.map(corner => {
      const dx = corner.x - centerX;
      const dy = corner.y - centerY;
      return {
        x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
      };
    });
    
    // Find bounding box of rotated corners
    const minX = Math.min(...rotatedCorners.map(c => c.x));
    const maxX = Math.max(...rotatedCorners.map(c => c.x));
    const minY = Math.min(...rotatedCorners.map(c => c.y));
    const maxY = Math.max(...rotatedCorners.map(c => c.y));
    
    cropX = minX;
    cropY = minY;
    cropWidth = maxX - minX;
    cropHeight = maxY - minY;
  }
  
  // Clamp to image bounds
  cropX = Math.max(0, Math.min(imageSize.width - 1, cropX));
  cropY = Math.max(0, Math.min(imageSize.height - 1, cropY));
  cropWidth = Math.max(1, Math.min(imageSize.width - cropX, cropWidth));
  cropHeight = Math.max(1, Math.min(imageSize.height - cropY, cropHeight));
  
  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
};

/**
 * Process and save edited image
 * Applies crop, rotation, and filters, then saves to app storage
 * 
 * Note: Actual image processing requires native modules.
 * This implementation provides the structure and coordinate conversion.
 * Native modules for iOS/Android would need to be implemented separately.
 */
export const processAndSaveImage = async (
  originalUri: string,
  imageSize: {width: number; height: number},
  cropParams: CropParams,
  transformParams: TransformParams,
  filterParams: FilterParams,
  outputFileName: string
): Promise<string> => {
  try {
    const sourcePath = originalUri.startsWith('file://')
      ? originalUri.replace('file://', '')
      : originalUri;
    
    // Ensure source file exists
    const sourceExists = await RNFS.exists(sourcePath);
    if (!sourceExists) {
      throw new Error(`Source image not found: ${sourcePath}`);
    }
    
    // Generate output path - edited images go to /images/edited/
    const imagesEditedDir = `${RNFS.DocumentDirectoryPath}/images/edited`;
    const dirExists = await RNFS.exists(imagesEditedDir);
    if (!dirExists) {
      await RNFS.mkdir(imagesEditedDir);
    }
    const outputPath = `${imagesEditedDir}/${outputFileName}`;
    
    // Check if we need to process the image
    const needsProcessing =
      transformParams.rotation !== 0 ||
      cropParams.x !== 0 ||
      cropParams.y !== 0 ||
      cropParams.width !== imageSize.width ||
      cropParams.height !== imageSize.height ||
      filterParams.brightness !== 0 ||
      filterParams.contrast !== 0 ||
      filterParams.saturation !== 0;
    
    if (!needsProcessing) {
      // No processing needed, just copy the file
      await RNFS.copyFile(sourcePath, outputPath);
      return outputPath;
    }
    
    // Process image using native capabilities
    // Note: This requires native implementation
    // For now, we'll copy and save metadata
    // In production, you would implement native modules for actual processing
    
    // Try to use platform-specific image processing
    if (Platform.OS === 'ios') {
      // iOS: Use native image processing
      await processImageIOS(
        sourcePath,
        outputPath,
        imageSize,
        cropParams,
        transformParams,
        filterParams
      );
    } else if (Platform.OS === 'android') {
      // Android: Use native image processing
      await processImageAndroid(
        sourcePath,
        outputPath,
        imageSize,
        cropParams,
        transformParams,
        filterParams
      );
    } else {
      // Fallback: Copy original and save metadata
      await RNFS.copyFile(sourcePath, outputPath);
    }
    
    return outputPath;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

/**
 * Process image on iOS
 * Note: This is a placeholder. Actual implementation requires native iOS code.
 * For now, copies the original image. Native implementation would use:
 * - UIImage for loading
 * - CGAffineTransform for rotation
 * - CGImageCreateWithImageInRect for cropping
 * - CIFilter for brightness/contrast/saturation
 * - UIImageJPEGRepresentation for saving
 */
async function processImageIOS(
  sourcePath: string,
  outputPath: string,
  imageSize: {width: number; height: number},
  cropParams: CropParams,
  transformParams: TransformParams,
  filterParams: FilterParams
): Promise<void> {
  // TODO: Implement native iOS image processing module
  // For now, copy the original image
  // The coordinate conversion is correct, but actual processing needs native code
  await RNFS.copyFile(sourcePath, outputPath);
  
  console.log('Image processing parameters:', {
    sourcePath,
    outputPath,
    imageSize,
    cropParams,
    transformParams,
    filterParams,
  });
}

/**
 * Process image on Android
 * Note: This is a placeholder. Actual implementation requires native Android code.
 * For now, copies the original image. Native implementation would use:
 * - BitmapFactory for loading
 * - Matrix for rotation
 * - Bitmap.createBitmap for cropping
 * - ColorMatrix for brightness/contrast/saturation
 * - Bitmap.compress for saving
 */
async function processImageAndroid(
  sourcePath: string,
  outputPath: string,
  imageSize: {width: number; height: number},
  cropParams: CropParams,
  transformParams: TransformParams,
  filterParams: FilterParams
): Promise<void> {
  // TODO: Implement native Android image processing module
  // For now, copy the original image
  // The coordinate conversion is correct, but actual processing needs native code
  await RNFS.copyFile(sourcePath, outputPath);
  
  console.log('Image processing parameters:', {
    sourcePath,
    outputPath,
    imageSize,
    cropParams,
    transformParams,
    filterParams,
  });
}

/**
 * Generate unique filename for edited image
 */
export const generateEditedImageFileName = (
  originalFileName: string,
  timestamp?: number
): string => {
  const ts = timestamp || Date.now();
  const ext = originalFileName.split('.').pop() || 'jpg';
  const baseName = originalFileName.replace(/\.[^/.]+$/, '');
  const sanitizedBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `edited_${ts}_${sanitizedBase}.${ext}`;
};

/**
 * Save image edit metadata
 */
export const saveImageEditMetadata = async (
  imageUri: string,
  metadata: ImageEditMetadata
): Promise<string> => {
  try {
    const imagePath = imageUri.startsWith('file://')
      ? imageUri.replace('file://', '')
      : imageUri;
    
    const metadataPath = `${imagePath}.metadata.json`;
    await RNFS.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    
    return metadataPath;
  } catch (error) {
    console.error('Error saving metadata:', error);
    throw error;
  }
};

/**
 * Load image edit metadata
 */
export const loadImageEditMetadata = async (
  imageUri: string
): Promise<ImageEditMetadata | null> => {
  try {
    const imagePath = imageUri.startsWith('file://')
      ? imageUri.replace('file://', '')
      : imageUri;
    
    const metadataPath = `${imagePath}.metadata.json`;
    const exists = await RNFS.exists(metadataPath);
    
    if (!exists) {
      return null;
    }
    
    const metadataJson = await RNFS.readFile(metadataPath, 'utf8');
    return JSON.parse(metadataJson);
  } catch (error) {
    console.error('Error loading metadata:', error);
    return null;
  }
};

/**
 * Apply transform to image style (for display)
 */
export const getImageTransformStyle = (
  transform: TransformParams
) => {
  return {
    transform: [
      {translateX: transform.translateX},
      {translateY: transform.translateY},
      {scale: transform.scale},
      {rotate: `${transform.rotation}deg`},
    ],
  };
};

/**
 * Create a cropped and processed image
 * This is the main function that coordinates all processing steps
 * 
 * @returns Object containing the processed image path and actual crop coordinates
 */
export const createCroppedImage = async (
  originalUri: string,
  imageSize: {width: number; height: number},
  displaySize: {width: number; height: number},
  cropArea: CropParams,
  transformParams: TransformParams,
  filterParams: FilterParams,
  outputFileName: string
): Promise<{imagePath: string; cropCoordinates: CropParams}> => {
  // Step 1: Convert crop area from screen space to image pixel coordinates
  const actualCrop = calculateCropCoordinates(
    imageSize,
    displaySize,
    cropArea,
    transformParams
  );
  
  // Step 2: Process and save the edited image
  const processedImagePath = await processAndSaveImage(
    originalUri,
    imageSize,
    actualCrop,
    transformParams,
    filterParams,
    outputFileName
  );
  
  // Step 3: Save metadata for reference
  const metadata: ImageEditMetadata = {
    originalUri,
    crop: actualCrop,
    transform: transformParams,
    filters: filterParams,
  };
  
  await saveImageEditMetadata(processedImagePath, metadata);
  
  return {
    imagePath: processedImagePath,
    cropCoordinates: actualCrop,
  };
};
