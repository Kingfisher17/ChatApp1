import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  Image,
  Platform,
  Dimensions,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import {MediaFile, CropAspectRatio, DrawingPath, TextSticker, EditorState} from '../types';
import {generateEditedImageFileName} from '../utils/imageProcessor';
import ImageCropOverlay from '../components/ImageCropOverlay';
import ImageAdjustSlider from '../components/ImageAdjustSlider';
import DrawingCanvas from '../components/DrawingCanvas';
import TextStickerComponent from '../components/TextSticker';
import {UndoRedoStack} from '../utils/undoRedo';
import {applyExifOrientation, getRotationForOrientation} from '../utils/exifOrientation';
import {fileManager} from '../utils/fileManager';
import {getImageDimensions} from '../utils/imageOptimizer';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const EDITOR_HEIGHT = SCREEN_HEIGHT - 120; // Full screen minus top and bottom bars
const CROP_SIZE = Math.min(SCREEN_WIDTH - 80, SCREEN_HEIGHT * 0.5);
const MIN_CROP_SIZE = 100;
const MAX_CROP_SIZE = Math.min(SCREEN_WIDTH - 80, SCREEN_HEIGHT * 0.6);

interface ImageEditorScreenProps {
  visible: boolean;
  onClose: () => void;
  onSave: (media: MediaFile) => void;
  sourceUri: string | null;
}

type CropHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | null;
type EditorMode = 'crop' | 'adjust' | 'draw' | 'text';

const DRAW_COLORS = [
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFFFFF', // White
  '#000000', // Black
];

const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({
  visible,
  onClose,
  onSave,
  sourceUri,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null); // Preview URI (may be downscaled)
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null); // Original high-res URI for export
  const [imageSize, setImageSize] = useState({width: 0, height: 0}); // Original image dimensions
  const [previewSize, setPreviewSize] = useState({width: 0, height: 0}); // Preview dimensions
  const [previewScale, setPreviewScale] = useState(1); // Scale factor from original to preview
  const [rotation, setRotation] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>('free');
  const [brightness, setBrightness] = useState(0); // -100 to 100
  const [contrast, setContrast] = useState(0); // -100 to 100
  const [saturation, setSaturation] = useState(0); // -100 to 100
  const [mode, setMode] = useState<EditorMode>('crop');
  const [activeHandle, setActiveHandle] = useState<CropHandle>(null);
  
  // Drawing state
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [drawColor, setDrawColor] = useState('#FF0000');
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(5);
  
  // Text sticker state
  const [textStickers, setTextStickers] = useState<TextSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  
  // EXIF orientation
  const [exifOrientation, setExifOrientation] = useState(1);
  
  // Undo/Redo
  const undoRedoStack = useRef(new UndoRedoStack(50));

  // Reanimated values for image transforms
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotationValue = useSharedValue(0);
  
  // Base values for gesture accumulation
  const baseScale = useSharedValue(1);
  const baseTranslateX = useSharedValue(0);
  const baseTranslateY = useSharedValue(0);
  
  // Animation settling state
  const [isAnimating, setIsAnimating] = useState(false);
  
  // ViewShot ref for capturing crop area
  const viewShotRef = useRef<ViewShot>(null);

  // Reanimated values for crop area { x, y, width, height }
  const cropX = useSharedValue((SCREEN_WIDTH - CROP_SIZE) / 2);
  const cropY = useSharedValue((EDITOR_HEIGHT - CROP_SIZE) / 2);
  const cropWidth = useSharedValue(CROP_SIZE);
  const cropHeight = useSharedValue(CROP_SIZE);
  
  // Base values for corner resize accumulation (store initial cropRect on gesture start)
  const baseCropX = useSharedValue(cropX.value);
  const baseCropY = useSharedValue(cropY.value);
  const baseCropWidth = useSharedValue(cropWidth.value);
  const baseCropHeight = useSharedValue(cropHeight.value);

  // Initial values for reset
  const initialCropWidth = useRef(CROP_SIZE);
  const initialCropHeight = useRef(CROP_SIZE);
  const initialScale = useRef(1);
  const initialTranslateX = useRef(0);
  const initialTranslateY = useRef(0);

  useEffect(() => {
    if (visible && sourceUri) {
      loadImage(sourceUri);
    } else if (!visible) {
      resetEditor();
    }
    
    // Cleanup on unmount
    return () => {
      if (!visible) {
        resetEditor();
      }
    };
  }, [visible, sourceUri]);

  useEffect(() => {
    // Update crop dimensions when aspect ratio changes (only in crop mode)
    if (imageSize.width > 0 && imageSize.height > 0 && mode === 'crop') {
      updateCropForAspectRatio();
    }
  }, [aspectRatio, imageSize, mode]);

  const resetEditor = () => {
    // Clear image references to allow garbage collection
    setImageUri(null);
    setOriginalImageUri(null);
    setImageSize({width: 0, height: 0});
    setPreviewSize({width: 0, height: 0});
    setPreviewScale(1);
    setRotation(0);
    setAspectRatio('free');
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setMode('crop');
    setActiveHandle(null);
    setDrawings([]);
    setTextStickers([]);
    setSelectedStickerId(null);
    setDrawColor('#FF0000');
    setDrawStrokeWidth(5);
    setExifOrientation(1);
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    rotationValue.value = 0;
    undoRedoStack.current.clear();
    
    // Note: React Native doesn't expose Image.clearMemoryCache in TypeScript
    // Memory will be freed automatically by garbage collector
  };

  const loadImage = async (uri: string) => {
    try {
      // Store original URI for export (high resolution)
      setOriginalImageUri(uri);
      
      // Get original image dimensions
      const {width: originalWidth, height: originalHeight} = await getImageDimensions(uri);
      
      setImageSize({width: originalWidth, height: originalHeight});
      setPreviewSize({width: originalWidth, height: originalHeight});
      setPreviewScale(1);
      
      // Use original URI for preview (React Native Image will handle downscaling via resizeMode)
      // For very large images, we could create a downscaled version here, but resizeMode="contain" 
      // already handles this efficiently
      setImageUri(uri);
      
      // Apply EXIF orientation correction (using original dimensions)
      try {
        await applyExifOrientation(uri, (width, height, orient) => {
          setExifOrientation(orient);
          
          // Apply rotation from EXIF orientation
          const rotationFromExif = getRotationForOrientation(orient);
          if (rotationFromExif !== 0) {
            setRotation(rotationFromExif);
            rotationValue.value = withTiming(rotationFromExif, {duration: 0});
          }
        });
      } catch (error) {
        // EXIF orientation is optional, continue without it
        console.warn('Could not read EXIF orientation:', error);
        setExifOrientation(1);
      }
      
      // Initialize crop area (fixed in center)
      cropWidth.value = CROP_SIZE;
      cropHeight.value = CROP_SIZE;
      
      initialCropWidth.current = CROP_SIZE;
      initialCropHeight.current = CROP_SIZE;
      
      // Initialize scale to fit crop area (use original dimensions for accurate scaling)
      const scaleToFit = Math.min(
        CROP_SIZE / originalWidth,
        CROP_SIZE / originalHeight
      );
      scale.value = scaleToFit;
      baseScale.value = scaleToFit;
      initialScale.current = scaleToFit;
    } catch (error) {
      console.error('Error loading image:', error);
      Alert.alert('Error', 'Failed to load image');
    }
  };

  /**
   * Update crop rectangle to match selected aspect ratio
   * Maintains center position while adjusting dimensions
   */
  const updateCropForAspectRatio = () => {
    if (aspectRatio === 'free') {
      return; // No constraint
    }
    
    const targetAspect = aspectRatio === '1:1' ? 1 :
                        aspectRatio === '4:5' ? 4/5 :
                        aspectRatio === '16:9' ? 16/9 : 1;
    
    const currentWidth = cropWidth.value;
    const currentHeight = cropHeight.value;
    const currentCenterX = cropX.value + currentWidth / 2;
    const currentCenterY = cropY.value + currentHeight / 2;
    
    // Calculate new dimensions maintaining aspect ratio
    // Use the smaller dimension to ensure it fits within bounds
    let newWidth: number;
    let newHeight: number;
    
    if (currentWidth / currentHeight > targetAspect) {
      // Current is wider than target - constrain by height
      newHeight = currentHeight;
      newWidth = newHeight * targetAspect;
    } else {
      // Current is taller than target - constrain by width
      newWidth = currentWidth;
      newHeight = newWidth / targetAspect;
    }
    
    // Ensure it fits within editor bounds
    const maxWidth = SCREEN_WIDTH - 40;
    const maxHeight = EDITOR_HEIGHT - 40;
    
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / targetAspect;
    }
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * targetAspect;
    }
    
    // Ensure minimum size
    if (newWidth < MIN_CROP_SIZE) {
      newWidth = MIN_CROP_SIZE;
      newHeight = newWidth / targetAspect;
    }
    if (newHeight < MIN_CROP_SIZE) {
      newHeight = MIN_CROP_SIZE;
      newWidth = newHeight * targetAspect;
    }
    
    // Calculate new position to keep center point fixed
    const newX = currentCenterX - newWidth / 2;
    const newY = currentCenterY - newHeight / 2;
    
    // Clamp to bounds and apply with smooth animation
    const clamped = clampCropToBounds(newX, newY, newWidth, newHeight);
    
    cropX.value = withSpring(clamped.x);
    cropY.value = withSpring(clamped.y);
    cropWidth.value = withSpring(clamped.width);
    cropHeight.value = withSpring(clamped.height);
    
    // Update base values
    baseCropX.value = clamped.x;
    baseCropY.value = clamped.y;
    baseCropWidth.value = clamped.width;
    baseCropHeight.value = clamped.height;
  };

  const handleRotate = () => {
    saveStateBeforeAction();
    // Normalize rotation to 0-360 range
    const newRotation = ((rotation + 90) % 360 + 360) % 360;
    setRotation(newRotation);
    setIsAnimating(true);
    rotationValue.value = withTiming(newRotation, {duration: 300}, () => {
      runOnJS(setIsAnimating)(false);
    });
  };

  // Get current editor state for undo/redo
  const getCurrentEditorState = (): EditorState => {
    return {
      rotation,
      scale: scale.value,
      translateX: translateX.value,
      translateY: translateY.value,
      cropWidth: cropWidth.value,
      cropHeight: cropHeight.value,
      brightness,
      contrast,
      saturation,
      drawings: [...drawings],
      textStickers: [...textStickers],
    };
  };

  // Apply editor state
  const applyEditorState = (state: EditorState) => {
    setRotation(state.rotation);
    setBrightness(state.brightness);
    setContrast(state.contrast);
    setSaturation(state.saturation);
    setDrawings(state.drawings);
    setTextStickers(state.textStickers);
    scale.value = state.scale;
    translateX.value = state.translateX;
    translateY.value = state.translateY;
    rotationValue.value = state.rotation;
    cropWidth.value = state.cropWidth;
    cropHeight.value = state.cropHeight;
  };

  // Save state before action
  const saveStateBeforeAction = () => {
    const currentState = getCurrentEditorState();
    undoRedoStack.current.saveState(currentState);
  };

  // Undo handler
  const handleUndo = () => {
    const currentState = getCurrentEditorState();
    const previousState = undoRedoStack.current.undo(currentState);
    if (previousState) {
      applyEditorState(previousState);
    }
  };

  // Redo handler
  const handleRedo = () => {
    const currentState = getCurrentEditorState();
    const nextState = undoRedoStack.current.redo(currentState);
    if (nextState) {
      applyEditorState(nextState);
    }
  };

  const handleReset = () => {
    saveStateBeforeAction();
    setRotation(0);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setDrawings([]);
    setTextStickers([]);
    scale.value = withSpring(initialScale.current);
    translateX.value = withSpring(initialTranslateX.current);
    translateY.value = withSpring(initialTranslateY.current);
    rotationValue.value = withSpring(0);
    cropWidth.value = withSpring(initialCropWidth.current);
    cropHeight.value = withSpring(initialCropHeight.current);
  };

  // Drawing handlers
  const handleDrawingStart = () => {
    // Save state when drawing starts, not when it completes
    saveStateBeforeAction();
  };

  const handleDrawingComplete = (path: DrawingPath) => {
    setDrawings((prev) => [...prev, path]);
  };

  // Text sticker handlers
  const handleAddTextSticker = () => {
    saveStateBeforeAction();
    const newSticker: TextSticker = {
      id: `sticker_${Date.now()}_${Math.random()}`,
      text: 'Tap to edit',
      x: SCREEN_WIDTH / 2 - 50,
      y: EDITOR_HEIGHT / 2 - 15,
      fontSize: 24,
      color: '#FFFFFF',
      rotation: 0,
      scale: 1,
    };
    setTextStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(newSticker.id);
    setMode('text');
  };

  const handleStickerUpdateStart = () => {
    saveStateBeforeAction();
  };

  const handleStickerUpdate = (updatedSticker: TextSticker) => {
    setTextStickers((prev) =>
      prev.map((s) => (s.id === updatedSticker.id ? updatedSticker : s))
    );
  };

  const handleStickerDelete = (stickerId: string) => {
    saveStateBeforeAction();
    setTextStickers((prev) => prev.filter((s) => s.id !== stickerId));
    if (selectedStickerId === stickerId) {
      setSelectedStickerId(null);
    }
  };

  // Wait for animations to settle
  const waitForAnimations = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!isAnimating) {
        // Small delay to ensure UI is fully rendered
        setTimeout(resolve, 100);
        return;
      }
      
      // Poll until animation completes
      const checkInterval = setInterval(() => {
        if (!isAnimating) {
          clearInterval(checkInterval);
          setTimeout(resolve, 100); // Small delay after animation
        }
      }, 50);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 2000);
    });
  };

  const handleSave = async () => {
    if (!imageUri || !originalImageUri || imageSize.width === 0 || imageSize.height === 0) return;

    try {
      // Wait for all animations to settle
      await waitForAnimations();

      // Normalize rotation to 0-360 range
      const normalizedRotation = ((rotation % 360) + 360) % 360;

      // Get current transform values (read from shared values)
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;
      const currentCropX = cropX.value;
      const currentCropY = cropY.value;
      const currentCropWidth = cropWidth.value;
      const currentCropHeight = cropHeight.value;

      // Generate output filename
      const sourcePath = originalImageUri.startsWith('file://')
        ? originalImageUri.replace('file://', '')
        : originalImageUri;
      const originalFileName = sourcePath.split('/').pop() || 'image.jpg';
      const timestamp = Date.now();
      const outputFileName = generateEditedImageFileName(originalFileName, timestamp);

      // CROP LOGIC:
      // ViewShot captures what's visually displayed on screen. Since ViewShot is positioned
      // exactly over the crop rectangle, and the image inside ViewShot has the same transforms
      // as the preview, ViewShot will capture exactly the crop area the user sees.
      //
      // The ViewShot structure:
      // - ViewShot positioned at (cropX, cropY) with size (cropWidth, cropHeight)
      //   - Offset container at (-cropX, -cropY) to align with full-screen image
      //     - imageContainer (SCREEN_WIDTH x EDITOR_HEIGHT) with transforms applied
      //       - Image with resizeMode="contain" and original high-res source
      //
      // This ensures the captured image exactly matches what the user sees in the preview.
      
      // Wait a bit for UI to settle and ensure ViewShot ref is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if ViewShot ref is available (it should be if imageUri exists)
      if (!viewShotRef.current) {
        console.error('ViewShot ref not available - imageUri:', imageUri);
        throw new Error('ViewShot ref not available. Please ensure the image is loaded.');
      }
      
      // Capture the crop area (ViewShot positioned over crop area in render)
      // ViewShot capture API
      const capturedUri = await (viewShotRef.current as any).capture({
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
      }) as string;
      
      if (!capturedUri) {
        throw new Error('Failed to capture image with ViewShot');
      }

      // Move captured image to permanent location
      const imagesEditedDir = `${RNFS.DocumentDirectoryPath}/images/edited`;
      const dirExists = await RNFS.exists(imagesEditedDir);
      if (!dirExists) {
        await RNFS.mkdir(imagesEditedDir);
      }
      
      const finalPath = `${imagesEditedDir}/${outputFileName}`;
      await RNFS.moveFile(capturedUri, finalPath);

      // Get file stats
      const stats = await RNFS.stat(finalPath);
      const editedImageUriWithFile = `file://${finalPath}`;

      const media: MediaFile = {
        uri: editedImageUriWithFile,
        name: outputFileName,
        type: 'image/jpeg',
        size: stats.size || 0,
        editMetadata: {
          rotation: normalizedRotation,
          scale: currentScale,
          translateX: currentTranslateX,
          translateY: currentTranslateY,
          crop: {
            x: currentCropX, // Screen-space crop coordinates (used for ViewShot positioning)
            y: currentCropY,
            width: currentCropWidth,
            height: currentCropHeight,
          },
          aspectRatio,
          brightness,
          contrast,
          saturation,
          drawings: drawings.length > 0 ? drawings : undefined,
          textStickers: textStickers.length > 0 ? textStickers : undefined,
          exifOrientation,
        },
      };

      onSave(media);
      handleClose();
    } catch (error) {
      console.error('Error saving edited image:', error);
      Alert.alert('Error', 'Failed to save edited image. Please try again.');
    }
  };

  const handleClose = () => {
    resetEditor();
    onClose();
  };

  // Pan gesture for moving image - accumulates translation
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      // Store current base translation when gesture starts
      baseTranslateX.value = translateX.value;
      baseTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Accumulate: base + current translation
      translateX.value = baseTranslateX.value + e.translationX;
      translateY.value = baseTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      // Update base values for next gesture
      baseTranslateX.value = translateX.value;
      baseTranslateY.value = translateY.value;
      setIsAnimating(true);
      translateX.value = withSpring(translateX.value, {}, () => {
        runOnJS(setIsAnimating)(false);
      });
      translateY.value = withSpring(translateY.value);
    });

  // Pinch gesture for zooming - accumulates scale and clamps to prevent empty space
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      // Store current base scale when gesture starts
      baseScale.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Accumulate: base * current scale
      const newScale = baseScale.value * e.scale;
      
      // Calculate minimum scale to fill crop area (prevent empty space)
      const minScale = Math.max(
        cropWidth.value / imageSize.width,
        cropHeight.value / imageSize.height
      );
      
      // Clamp scale between minScale and 3x
      scale.value = Math.max(minScale, Math.min(newScale, 3));
    })
    .onEnd(() => {
      'worklet';
      // Update base scale for next gesture
      baseScale.value = scale.value;
      setIsAnimating(true);
      scale.value = withSpring(scale.value, {}, () => {
        runOnJS(setIsAnimating)(false);
      });
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  /**
   * Clamp crop rectangle to stay within editor bounds
   */
  const clampCropToBounds = (
    x: number,
    y: number,
    width: number,
    height: number
  ): {x: number; y: number; width: number; height: number} => {
    // Clamp width and height to minimum
    width = Math.max(MIN_CROP_SIZE, width);
    height = Math.max(MIN_CROP_SIZE, height);
    
    // Clamp to editor bounds
    if (x < 0) {
      width = width + x; // Reduce width by overflow amount
      x = 0;
    }
    if (y < 0) {
      height = height + y; // Reduce height by overflow amount
      y = 0;
    }
    if (x + width > SCREEN_WIDTH) {
      width = SCREEN_WIDTH - x;
    }
    if (y + height > EDITOR_HEIGHT) {
      height = EDITOR_HEIGHT - y;
    }
    
    // Ensure minimum size after clamping
    width = Math.max(MIN_CROP_SIZE, width);
    height = Math.max(MIN_CROP_SIZE, height);
    
    // Final boundary check
    if (x + width > SCREEN_WIDTH) {
      x = SCREEN_WIDTH - width;
    }
    if (y + height > EDITOR_HEIGHT) {
      y = EDITOR_HEIGHT - height;
    }
    
    return {x, y, width, height};
  };

  /**
   * Premium corner-only resize gesture
   * Each corner drag keeps the opposite corner fixed
   */
  const createCornerHandleGesture = (handle: CropHandle) => {
    return Gesture.Pan()
      .onStart(() => {
        'worklet';
        // Store initial cropRect values for accumulation
        baseCropX.value = cropX.value;
        baseCropY.value = cropY.value;
        baseCropWidth.value = cropWidth.value;
        baseCropHeight.value = cropHeight.value;
        runOnJS(setActiveHandle)(handle);
      })
      .onUpdate((e) => {
        'worklet';
        if (!handle) return;
        
        const deltaX = e.translationX;
        const deltaY = e.translationY;
        
        let newX = baseCropX.value;
        let newY = baseCropY.value;
        let newWidth = baseCropWidth.value;
        let newHeight = baseCropHeight.value;
        
        // Calculate new cropRect based on which corner is dragged
        // Opposite corner stays fixed
        switch (handle) {
          case 'topLeft': {
            // Top-left corner dragged: bottom-right corner stays fixed
            newX = baseCropX.value + deltaX;
            newY = baseCropY.value + deltaY;
            newWidth = baseCropWidth.value - deltaX;
            newHeight = baseCropHeight.value - deltaY;
            break;
          }
          case 'topRight': {
            // Top-right corner dragged: bottom-left corner stays fixed
            newY = baseCropY.value + deltaY;
            newWidth = baseCropWidth.value + deltaX;
            newHeight = baseCropHeight.value - deltaY;
            break;
          }
          case 'bottomLeft': {
            // Bottom-left corner dragged: top-right corner stays fixed
            newX = baseCropX.value + deltaX;
            newWidth = baseCropWidth.value - deltaX;
            newHeight = baseCropHeight.value + deltaY;
            break;
          }
          case 'bottomRight': {
            // Bottom-right corner dragged: top-left corner stays fixed
            newWidth = baseCropWidth.value + deltaX;
            newHeight = baseCropHeight.value + deltaY;
            break;
          }
        }
        
        // Apply aspect ratio constraint if locked
        if (aspectRatio !== 'free') {
          const targetAspect = aspectRatio === '1:1' ? 1 :
                              aspectRatio === '4:5' ? 4/5 :
                              aspectRatio === '16:9' ? 16/9 : 1;
          
          // Calculate which dimension to use as primary based on drag direction
          // This ensures the resize feels natural and follows the user's drag
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);
          
          // Calculate fixed corner position (opposite of dragged corner)
          const fixedCornerX = handle === 'topLeft' || handle === 'bottomLeft' 
            ? baseCropX.value + baseCropWidth.value  // Right edge
            : baseCropX.value;  // Left edge
            
          const fixedCornerY = handle === 'topLeft' || handle === 'topRight'
            ? baseCropY.value + baseCropHeight.value  // Bottom edge
            : baseCropY.value;  // Top edge
          
          if (absDeltaX > absDeltaY) {
            // Horizontal movement is dominant - use width as primary
            // newWidth is already calculated from drag delta
            newHeight = newWidth / targetAspect;
            
            // Recalculate position to keep the fixed corner at the same position
            if (handle === 'topLeft' || handle === 'bottomLeft') {
              // Fixed corner is on the right edge
              newX = fixedCornerX - newWidth;
            } else {
              // Fixed corner is on the left edge, X stays same
              newX = baseCropX.value;
            }
            
            if (handle === 'topLeft' || handle === 'topRight') {
              // Fixed corner is on the bottom edge
              newY = fixedCornerY - newHeight;
            } else {
              // Fixed corner is on the top edge, Y stays same
              newY = baseCropY.value;
            }
          } else {
            // Vertical movement is dominant - use height as primary
            // newHeight is already calculated from drag delta
            newWidth = newHeight * targetAspect;
            
            // Recalculate position to keep the fixed corner at the same position
            if (handle === 'topLeft' || handle === 'bottomLeft') {
              // Fixed corner is on the right edge
              newX = fixedCornerX - newWidth;
            } else {
              // Fixed corner is on the left edge, X stays same
              newX = baseCropX.value;
            }
            
            if (handle === 'topLeft' || handle === 'topRight') {
              // Fixed corner is on the bottom edge
              newY = fixedCornerY - newHeight;
            } else {
              // Fixed corner is on the top edge, Y stays same
              newY = baseCropY.value;
            }
          }
        }
        
        // Clamp to bounds
        const clamped = clampCropToBounds(newX, newY, newWidth, newHeight);
        
        // Apply with smooth animation
        cropX.value = clamped.x;
        cropY.value = clamped.y;
        cropWidth.value = clamped.width;
        cropHeight.value = clamped.height;
      })
      .onEnd(() => {
        'worklet';
        // Update base values for next gesture
        baseCropX.value = cropX.value;
        baseCropY.value = cropY.value;
        baseCropWidth.value = cropWidth.value;
        baseCropHeight.value = cropHeight.value;
        runOnJS(setActiveHandle)(null);
      });
  };

  // Animated styles - must be called unconditionally (Rules of Hooks)
  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {scale: scale.value},
        {rotate: `${rotationValue.value}deg`},
      ] as any,
    };
  });

  // Calculate filter opacity for preview
  const filterOpacity = useAnimatedStyle(() => {
    const brightnessMultiplier = 1 + (brightness / 200);
    return {
      opacity: Math.max(0.3, Math.min(1, brightnessMultiplier * 0.7 + 0.3)),
    };
  }, [brightness]);

  // Overlay animated styles - must be called unconditionally
  const overlayTopStyle = useAnimatedStyle(() => ({
    height: cropY.value,
  }));

  const overlayLeftStyle = useAnimatedStyle(() => ({
    left: 0,
    top: cropY.value,
    width: cropX.value,
    height: cropHeight.value,
  }));

  const overlayRightStyle = useAnimatedStyle(() => ({
    left: cropX.value + cropWidth.value,
    top: cropY.value,
    width: SCREEN_WIDTH - cropX.value - cropWidth.value,
    height: cropHeight.value,
  }));

  const overlayBottomStyle = useAnimatedStyle(() => ({
    top: cropY.value + cropHeight.value,
    height: EDITOR_HEIGHT - cropY.value - cropHeight.value,
  }));

  // ViewShot wrapper style - positioned exactly over crop area for capture
  const viewShotWrapperStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: cropX.value,
    top: cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
    overflow: 'hidden',
  }));

  // ViewShot image offset style - positions full screen image correctly inside ViewShot
  // This ensures the crop area aligns with what the user sees in preview
  const viewShotImageOffsetStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: -cropX.value,
    top: -cropY.value,
    width: SCREEN_WIDTH,
    height: EDITOR_HEIGHT,
  }));



  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Top Bar: Close | Undo | Redo | Rotate | Reset */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} style={styles.topBarButton}>
            <Text style={styles.topBarButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUndo}
            disabled={!undoRedoStack.current.canUndo()}
            style={[
              styles.topBarButton,
              !undoRedoStack.current.canUndo() && styles.topBarButtonDisabled,
            ]}>
            <Text
              style={[
                styles.topBarButtonText,
                !undoRedoStack.current.canUndo() && styles.topBarButtonTextDisabled,
              ]}>
              ↶ Undo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRedo}
            disabled={!undoRedoStack.current.canRedo()}
            style={[
              styles.topBarButton,
              !undoRedoStack.current.canRedo() && styles.topBarButtonDisabled,
            ]}>
            <Text
              style={[
                styles.topBarButtonText,
                !undoRedoStack.current.canRedo() && styles.topBarButtonTextDisabled,
              ]}>
              ↷ Redo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRotate} style={styles.topBarButton}>
            <Text style={styles.topBarButtonText}>Rotate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={styles.topBarButton}>
            <Text style={styles.topBarButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Aspect Ratio Selector - shown only in Crop mode */}
        {mode === 'crop' && (
          <View style={styles.aspectRatioSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['free', '1:1', '4:5', '16:9'] as CropAspectRatio[]).map((ratio) => (
                <TouchableOpacity
                  key={ratio}
                  style={[
                    styles.aspectRatioButton,
                    aspectRatio === ratio && styles.aspectRatioButtonActive,
                  ]}
                  onPress={() => {
                    saveStateBeforeAction();
                    setAspectRatio(ratio);
                  }}>
                  <Text
                    style={[
                      styles.aspectRatioText,
                      aspectRatio === ratio && styles.aspectRatioTextActive,
                    ]}>
                    {ratio === 'free' ? 'Free' : ratio}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {imageUri && (
          <View style={styles.editorContainer}>
            <View style={styles.imageWrapper}>
              {/* Dark overlay outside crop area */}
              <Animated.View
                style={[styles.overlayTop, overlayTopStyle]}
                pointerEvents="none"
              />
              <Animated.View
                style={[styles.overlaySide, overlayLeftStyle]}
                pointerEvents="none"
              />
              <Animated.View
                style={[styles.overlaySide, overlayRightStyle]}
                pointerEvents="none"
              />
              <Animated.View
                style={[styles.overlayBottom, overlayBottomStyle]}
                pointerEvents="none"
              />

              {/* ViewShot for capturing crop area - positioned exactly over crop box */}
              {/* Always render ViewShot when imageUri exists to ensure ref is available */}
              {imageUri && originalImageUri && (
                <Animated.View
                  style={viewShotWrapperStyle}
                  collapsable={false}
                  pointerEvents="none">
                  <ViewShot
                    ref={viewShotRef}
                    style={StyleSheet.absoluteFill}
                    options={{
                      format: 'jpg',
                      quality: 0.95,
                    }}>
                    {/* Render transformed image inside ViewShot to match preview exactly */}
                    {/* Container offset to align crop area with full-screen image position */}
                    <Animated.View style={viewShotImageOffsetStyle}>
                      {/* Same container style as preview */}
                      <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
                        {/* Use original high-res image for export quality */}
                        <Image
                          source={{uri: originalImageUri}}
                          style={styles.image}
                          resizeMode="contain"
                        />
                      </Animated.View>
                    </Animated.View>
                  </ViewShot>
                </Animated.View>
              )}

              {/* Full-screen image for preview */}
              {mode !== 'draw' && mode !== 'text' ? (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View 
                    style={[styles.imageContainer, imageAnimatedStyle]}
                    pointerEvents="box-none">
                    <Animated.Image
                      source={{uri: imageUri}}
                      style={[styles.image, filterOpacity]}
                      resizeMode="contain"
                      // Memory optimizations for Android
                      resizeMethod="resize"
                      // Reduce memory footprint for preview
                      defaultSource={undefined}
                    />
                  </Animated.View>
                </GestureDetector>
              ) : (
                <Animated.View 
                  style={[styles.imageContainer, imageAnimatedStyle]}
                  pointerEvents="box-none">
                    <Animated.Image
                      source={{uri: imageUri}}
                      style={[styles.image, filterOpacity]}
                      resizeMode="contain"
                      // Memory optimizations for Android
                      resizeMethod="resize"
                      // Reduce memory footprint for preview
                      defaultSource={undefined}
                    />
                </Animated.View>
              )}

              {/* Drawing Canvas - full screen for interaction */}
              {mode === 'draw' && (
                <DrawingCanvas
                  width={SCREEN_WIDTH}
                  height={EDITOR_HEIGHT}
                  drawings={drawings}
                  onDrawingComplete={handleDrawingComplete}
                  onDrawingStart={handleDrawingStart}
                  strokeColor={drawColor}
                  strokeWidth={drawStrokeWidth}
                  enabled={mode === 'draw'}
                />
              )}

              {/* Text Stickers - full screen for interaction */}
              {textStickers.map((sticker) => (
                <TextStickerComponent
                  key={sticker.id}
                  sticker={sticker}
                  onUpdate={handleStickerUpdate}
                  onUpdateStart={handleStickerUpdateStart}
                  onDelete={() => handleStickerDelete(sticker.id)}
                  isSelected={selectedStickerId === sticker.id}
                  onSelect={() => setSelectedStickerId(sticker.id)}
                />
              ))}


              {/* Crop overlay with corner handles - only show in crop mode */}
              {mode === 'crop' && (
                <>
                  <ImageCropOverlay
                    cropX={cropX}
                    cropY={cropY}
                    cropWidth={cropWidth}
                    cropHeight={cropHeight}
                    screenWidth={SCREEN_WIDTH}
                    editorHeight={EDITOR_HEIGHT}
                    onCornerPress={setActiveHandle}
                  />
                  
                  {/* Corner resize gestures */}
                  <GestureDetector gesture={createCornerHandleGesture('topLeft')}>
                    <View style={[styles.cornerGestureArea, styles.topLeftArea]} />
                  </GestureDetector>
                  <GestureDetector gesture={createCornerHandleGesture('topRight')}>
                    <View style={[styles.cornerGestureArea, styles.topRightArea]} />
                  </GestureDetector>
                  <GestureDetector gesture={createCornerHandleGesture('bottomLeft')}>
                    <View style={[styles.cornerGestureArea, styles.bottomLeftArea]} />
                  </GestureDetector>
                  <GestureDetector gesture={createCornerHandleGesture('bottomRight')}>
                    <View style={[styles.cornerGestureArea, styles.bottomRightArea]} />
                  </GestureDetector>
                </>
              )}
            </View>
          </View>
        )}

        {/* Bottom Bar: Crop | Adjust | Draw | Text | Done */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.bottomBarButton, mode === 'crop' && styles.bottomBarButtonActive]}
            onPress={() => {
              if (mode !== 'crop') {
                saveStateBeforeAction();
              }
              setMode('crop');
            }}>
            <Text
              style={[
                styles.bottomBarButtonText,
                mode === 'crop' && styles.bottomBarButtonTextActive,
              ]}>
              Crop
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomBarButton, mode === 'adjust' && styles.bottomBarButtonActive]}
            onPress={() => {
              if (mode !== 'adjust') {
                saveStateBeforeAction();
              }
              setMode('adjust');
            }}>
            <Text
              style={[
                styles.bottomBarButtonText,
                mode === 'adjust' && styles.bottomBarButtonTextActive,
              ]}>
              Adjust
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomBarButton, mode === 'draw' && styles.bottomBarButtonActive]}
            onPress={() => {
              if (mode !== 'draw') {
                saveStateBeforeAction();
              }
              setMode('draw');
            }}>
            <Text
              style={[
                styles.bottomBarButtonText,
                mode === 'draw' && styles.bottomBarButtonTextActive,
              ]}>
              Draw
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomBarButton, mode === 'text' && styles.bottomBarButtonActive]}
            onPress={handleAddTextSticker}>
            <Text
              style={[
                styles.bottomBarButtonText,
                mode === 'text' && styles.bottomBarButtonTextActive,
              ]}>
              Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBarDoneButton} onPress={handleSave}>
            <Text style={styles.bottomBarDoneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Sliders - shown only in Adjust mode */}
        {mode === 'adjust' && (
          <View style={styles.filtersContainer}>
            <ImageAdjustSlider
              label="Brightness"
              value={brightness}
              onValueChange={setBrightness}
            />
            <ImageAdjustSlider
              label="Contrast"
              value={contrast}
              onValueChange={setContrast}
            />
            <ImageAdjustSlider
              label="Saturation"
              value={saturation}
              onValueChange={setSaturation}
            />
          </View>
        )}

        {/* Drawing Tools - shown only in Draw mode */}
        {mode === 'draw' && (
          <View style={styles.drawingToolsContainer}>
            <View style={styles.colorPicker}>
              <Text style={styles.drawingToolsLabel}>Color:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {DRAW_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      {backgroundColor: color},
                      drawColor === color && styles.colorButtonSelected,
                    ]}
                    onPress={() => setDrawColor(color)}
                  />
                ))}
              </ScrollView>
            </View>
            <View style={styles.strokeWidthContainer}>
              <Text style={styles.drawingToolsLabel}>Stroke: {drawStrokeWidth}px</Text>
              <View style={styles.strokeWidthButtons}>
                <TouchableOpacity
                  style={styles.strokeWidthButton}
                  onPress={() => setDrawStrokeWidth(Math.max(1, drawStrokeWidth - 1))}>
                  <Text style={styles.strokeWidthButtonText}>-</Text>
                </TouchableOpacity>
                <View style={styles.strokeWidthDisplay}>
                  <Text style={styles.strokeWidthValue}>{drawStrokeWidth}</Text>
                </View>
                <TouchableOpacity
                  style={styles.strokeWidthButton}
                  onPress={() => setDrawStrokeWidth(Math.min(20, drawStrokeWidth + 1))}>
                  <Text style={styles.strokeWidthButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  topBarButton: {
    padding: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  topBarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  topBarButtonDisabled: {
    opacity: 0.5,
  },
  topBarButtonTextDisabled: {
    color: '#666666',
  },
  aspectRatioSelector: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  aspectRatioButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  aspectRatioButtonActive: {
    backgroundColor: '#25D366',
  },
  aspectRatioText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  aspectRatioTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  editorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: EDITOR_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: EDITOR_HEIGHT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cornerGestureArea: {
    position: 'absolute',
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  topLeftArea: {
    top: -20,
    left: -20,
  },
  topRightArea: {
    top: -20,
    right: -20,
  },
  bottomLeftArea: {
    bottom: -20,
    left: -20,
  },
  bottomRightArea: {
    bottom: -20,
    right: -20,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlaySide: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 12,
  },
  bottomBarButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#333',
  },
  bottomBarButtonActive: {
    backgroundColor: '#2a2a2a',
  },
  bottomBarButtonText: {
    color: '#999999',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomBarButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomBarDoneButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#25D366',
  },
  bottomBarDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
  },
  drawingToolsContainer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
  },
  drawingToolsLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  colorPicker: {
    marginBottom: 16,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#333',
  },
  colorButtonSelected: {
    borderColor: '#25D366',
    borderWidth: 3,
  },
  strokeWidthContainer: {
    marginTop: 8,
  },
  strokeWidthButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  strokeWidthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  strokeWidthButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  strokeWidthDisplay: {
    width: 60,
    height: 40,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  strokeWidthValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageEditorScreen;

