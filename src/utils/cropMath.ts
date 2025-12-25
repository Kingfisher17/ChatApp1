/**
 * Real crop implementation using pixel-accurate coordinate conversion
 * Converts screen-space crop rectangle to image-space pixel coordinates
 */

interface ScreenCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageDisplayParams {
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number; // degrees
}

/**
 * Calculate how the image is displayed on screen given transforms
 */
export const calculateImageDisplayBounds = (params: ImageDisplayParams): {
  displayedWidth: number;
  displayedHeight: number;
  displayedX: number;
  displayedY: number;
} => {
  const {imageWidth, imageHeight, displayWidth, displayHeight, scale, translateX, translateY, rotation} = params;
  
  // Calculate scaled dimensions
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;
  
  // For rotation, calculate bounding box
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  
  // Rotated bounding box dimensions
  const rotatedWidth = scaledWidth * cos + scaledHeight * sin;
  const rotatedHeight = scaledWidth * sin + scaledHeight * cos;
  
  // Image is centered on screen, then translated
  const displayedX = (displayWidth - rotatedWidth) / 2 + translateX;
  const displayedY = (displayHeight - rotatedHeight) / 2 + translateY;
  
  return {
    displayedWidth: rotatedWidth,
    displayedHeight: rotatedHeight,
    displayedX,
    displayedY,
  };
};

/**
 * Convert screen-space crop rectangle to image-space pixel coordinates
 * This is the core function that makes real cropping work
 */
export const screenToImageCoordinates = (
  screenCrop: ScreenCropRect,
  params: ImageDisplayParams
): ImageCropRect => {
  const {imageWidth, imageHeight, scale, translateX, translateY, rotation} = params;
  
  // Get how the image is displayed on screen
  const displayBounds = calculateImageDisplayBounds(params);
  
  // Calculate the scale factor from screen to image
  // The displayed image size vs actual image size
  const screenToImageScaleX = imageWidth / (imageWidth * scale);
  const screenToImageScaleY = imageHeight / (imageHeight * scale);
  
  // Convert crop rectangle from screen coordinates to image coordinates
  // First, translate crop rect relative to displayed image position
  const cropRelativeX = screenCrop.x - displayBounds.displayedX;
  const cropRelativeY = screenCrop.y - displayBounds.displayedY;
  
  // Convert to image coordinates (before rotation)
  let imageCropX = cropRelativeX / scale;
  let imageCropY = cropRelativeY / scale;
  let imageCropWidth = screenCrop.width / scale;
  let imageCropHeight = screenCrop.height / scale;
  
  // If rotated, we need to reverse the rotation to get original image coordinates
  if (rotation !== 0) {
    const radians = (-rotation * Math.PI) / 180; // Negative to reverse rotation
    const centerX = imageWidth / 2;
    const centerY = imageHeight / 2;
    
    // Get all four corners of the crop rectangle in image space
    const corners = [
      {x: imageCropX, y: imageCropY},
      {x: imageCropX + imageCropWidth, y: imageCropY},
      {x: imageCropX, y: imageCropY + imageCropHeight},
      {x: imageCropX + imageCropWidth, y: imageCropY + imageCropHeight},
    ];
    
    // Rotate corners back (reverse the display rotation)
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
    
    imageCropX = minX;
    imageCropY = minY;
    imageCropWidth = maxX - minX;
    imageCropHeight = maxY - minY;
  }
  
  // Clamp to image bounds
  imageCropX = Math.max(0, Math.min(imageWidth - 1, imageCropX));
  imageCropY = Math.max(0, Math.min(imageHeight - 1, imageCropY));
  imageCropWidth = Math.max(1, Math.min(imageWidth - imageCropX, imageCropWidth));
  imageCropHeight = Math.max(1, Math.min(imageHeight - imageCropY, imageCropHeight));
  
  return {
    x: Math.round(imageCropX),
    y: Math.round(imageCropY),
    width: Math.round(imageCropWidth),
    height: Math.round(imageCropHeight),
  };
};

/**
 * Calculate minimum scale to prevent empty space in crop frame
 */
export const calculateMinScale = (
  imageWidth: number,
  imageHeight: number,
  cropWidth: number,
  cropHeight: number
): number => {
  // Scale needed to fill crop area
  const scaleX = cropWidth / imageWidth;
  const scaleY = cropHeight / imageHeight;
  return Math.max(scaleX, scaleY);
};


