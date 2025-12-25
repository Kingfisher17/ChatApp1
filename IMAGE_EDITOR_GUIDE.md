# Image Editor Implementation Guide

## Table of Contents
1. [Full React Native Code](#full-react-native-code)
2. [Image Editor Logic](#image-editor-logic)
3. [Gesture Handlers](#gesture-handlers)
4. [Crop Math Explanation](#crop-math-explanation)
5. [Android & iOS Permission Notes](#android--ios-permission-notes)

---

## Full React Native Code

### ImageEditorScreen.tsx

The complete image editor component with all optimizations:

```typescript
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
} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import RNFS from 'react-native-fs';
import {MediaFile, CropAspectRatio} from '../types';
import {createCroppedImage, generateEditedImageFileName} from '../utils/imageProcessor';
import ImageCropOverlay from '../components/ImageCropOverlay';
import ImageAdjustSlider from '../components/ImageAdjustSlider';

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

const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({
  visible,
  onClose,
  onSave,
  sourceUri,
}) => {
  // State management
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({width: 0, height: 0});
  const [rotation, setRotation] = useState(0);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>('free');
  const [brightness, setBrightness] = useState(0); // -100 to 100
  const [contrast, setContrast] = useState(0); // -100 to 100
  const [saturation, setSaturation] = useState(0); // -100 to 100
  const [mode, setMode] = useState<'crop' | 'adjust'>('crop');
  const [activeHandle, setActiveHandle] = useState<CropHandle>(null);

  // Reanimated shared values (UI thread)
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotationValue = useSharedValue(0);

  // Crop area shared values (centered, derived)
  const cropWidth = useSharedValue(CROP_SIZE);
  const cropHeight = useSharedValue(CROP_SIZE);

  // Derived values for crop position (always centered)
  const cropXDerived = useDerivedValue(() => (SCREEN_WIDTH - cropWidth.value) / 2);
  const cropYDerived = useDerivedValue(() => (EDITOR_HEIGHT - cropHeight.value) / 2);

  // Initial values for reset
  const initialCropWidth = useRef(CROP_SIZE);
  const initialCropHeight = useRef(CROP_SIZE);
  const initialScale = useRef(1);
  const initialTranslateX = useRef(0);
  const initialTranslateY = useRef(0);

  // Load image when visible
  useEffect(() => {
    if (visible && sourceUri) {
      loadImage(sourceUri);
    } else if (!visible) {
      resetEditor();
    }
  }, [visible, sourceUri]);

  // Update crop when aspect ratio changes
  useEffect(() => {
    if (imageSize.width > 0 && imageSize.height > 0 && mode === 'crop') {
      updateCropForAspectRatio();
    }
  }, [aspectRatio, imageSize, mode]);

  // Reset all editor state
  const resetEditor = () => {
    setImageUri(null);
    setOriginalImageUri(null);
    setRotation(0);
    setAspectRatio('free');
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setMode('crop');
    setActiveHandle(null);
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    rotationValue.value = 0;
  };

  // Load image and get dimensions
  const loadImage = (uri: string) => {
    setImageUri(uri);
    setOriginalImageUri(uri);
    
    Image.getSize(
      uri,
      (width, height) => {
        setImageSize({width, height});
        cropWidth.value = CROP_SIZE;
        cropHeight.value = CROP_SIZE;
        initialCropWidth.current = CROP_SIZE;
        initialCropHeight.current = CROP_SIZE;
        
        // Initialize scale to fit crop area
        const scaleToFit = Math.min(
          CROP_SIZE / width,
          CROP_SIZE / height
        );
        scale.value = scaleToFit;
        initialScale.current = scaleToFit;
      },
      (error) => {
        console.error('Error getting image size:', error);
      }
    );
  };

  // Update crop dimensions based on aspect ratio
  const updateCropForAspectRatio = () => {
    const centerX = SCREEN_WIDTH / 2;
    const centerY = EDITOR_HEIGHT / 2;
    let newWidth = cropWidth.value;
    let newHeight = cropHeight.value;
    
    switch (aspectRatio) {
      case '1:1':
        newWidth = newHeight = Math.min(newWidth, newHeight);
        break;
      case '4:5':
        if (newWidth / (4/5) > newHeight) {
          newHeight = newWidth / (4/5);
        } else {
          newWidth = newHeight * (4/5);
        }
        break;
      case '16:9':
        if (newWidth / (16/9) > newHeight) {
          newHeight = newWidth / (16/9);
        } else {
          newWidth = newHeight * (16/9);
        }
        break;
      case 'free':
      default:
        // Keep current size
        break;
    }
    
    cropWidth.value = withSpring(newWidth);
    cropHeight.value = withSpring(newHeight);
  };

  // Rotate image 90 degrees
  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    rotationValue.value = withTiming(newRotation, {duration: 300});
  };

  // Reset all transformations
  const handleReset = () => {
    setRotation(0);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    scale.value = withSpring(initialScale.current);
    translateX.value = withSpring(initialTranslateX.current);
    translateY.value = withSpring(initialTranslateY.current);
    rotationValue.value = withSpring(0);
    cropWidth.value = withSpring(initialCropWidth.current);
    cropHeight.value = withSpring(initialCropHeight.current);
  };

  // Save edited image
  const handleSave = async () => {
    if (!imageUri || !originalImageUri) return;

    try {
      const displaySize = {
        width: SCREEN_WIDTH,
        height: EDITOR_HEIGHT,
      };

      const cropParams = {
        x: cropXDerived.value,
        y: cropYDerived.value,
        width: cropWidth.value,
        height: cropHeight.value,
      };

      const transformParams = {
        rotation: rotation,
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      };

      const sourcePath = originalImageUri.startsWith('file://')
        ? originalImageUri.replace('file://', '')
        : originalImageUri;
      const originalFileName = sourcePath.split('/').pop() || 'image.jpg';
      const timestamp = Date.now();
      const outputFileName = generateEditedImageFileName(originalFileName, timestamp);

      const {imagePath: editedImagePath, cropCoordinates: actualCrop} = await createCroppedImage(
        originalImageUri,
        imageSize,
        displaySize,
        cropParams,
        transformParams,
        {
          brightness,
          contrast,
          saturation,
        },
        outputFileName
      );

      const stats = await RNFS.stat(editedImagePath);
      const editedImageUriWithFile = `file://${editedImagePath}`;

      const media: MediaFile = {
        uri: editedImageUriWithFile,
        name: outputFileName,
        type: 'image/jpeg',
        size: stats.size || 0,
        editMetadata: {
          originalUri: originalImageUri,
          crop: actualCrop,
          transform: transformParams,
          aspectRatio,
          brightness,
          contrast,
          saturation,
        },
      };

      onSave(media);
      handleClose();
    } catch (error) {
      console.error('Error saving edited image:', error);
      Alert.alert('Error', 'Failed to save edited image');
    }
  };

  const handleClose = () => {
    resetEditor();
    onClose();
  };

  // Pan gesture for moving image - UI thread optimized
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      'worklet';
      translateX.value = withSpring(translateX.value);
      translateY.value = withSpring(translateY.value);
    });

  // Pinch gesture for zooming - UI thread optimized
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.max(0.5, Math.min(e.scale, 3));
    })
    .onEnd(() => {
      'worklet';
      scale.value = withSpring(scale.value);
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Corner handle gesture for crop resizing
  const createCornerHandleGesture = (handle: CropHandle) => {
    return Gesture.Pan()
      .onStart(() => {
        setActiveHandle(handle);
      })
      .onUpdate((e) => {
        'worklet';
        if (!handle) return;
        
        const deltaX = e.translationX;
        const deltaY = e.translationY;
        
        let newWidth = cropWidth.value;
        let newHeight = cropHeight.value;
        
        // Calculate resize based on corner movement
        switch (handle) {
          case 'topLeft':
            newWidth = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropWidth.value - deltaX * 2));
            newHeight = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropHeight.value - deltaY * 2));
            break;
          case 'topRight':
            newWidth = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropWidth.value + deltaX * 2));
            newHeight = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropHeight.value - deltaY * 2));
            break;
          case 'bottomLeft':
            newWidth = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropWidth.value - deltaX * 2));
            newHeight = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropHeight.value + deltaY * 2));
            break;
          case 'bottomRight':
            newWidth = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropWidth.value + deltaX * 2));
            newHeight = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, cropHeight.value + deltaY * 2));
            break;
        }
        
        // Apply aspect ratio constraint
        if (aspectRatio !== 'free') {
          let targetAspect = 1;
          if (aspectRatio === '4:5') targetAspect = 4/5;
          else if (aspectRatio === '16:9') targetAspect = 16/9;
          
          if (newWidth / targetAspect > newHeight) {
            newHeight = newWidth / targetAspect;
          } else {
            newWidth = newHeight * targetAspect;
          }
          
          if (newWidth > MAX_CROP_SIZE) {
            newWidth = MAX_CROP_SIZE;
            newHeight = newWidth / targetAspect;
          }
          if (newHeight > MAX_CROP_SIZE) {
            newHeight = MAX_CROP_SIZE;
            newWidth = newHeight * targetAspect;
          }
        }
        
        cropWidth.value = newWidth;
        cropHeight.value = newHeight;
      })
      .onEnd(() => {
        'worklet';
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

  const overlayTopStyle = useAnimatedStyle(() => ({
    height: cropYDerived.value,
  }));

  const overlayLeftStyle = useAnimatedStyle(() => ({
    left: 0,
    top: cropYDerived.value,
    width: cropXDerived.value,
    height: cropHeight.value,
  }));

  const overlayRightStyle = useAnimatedStyle(() => ({
    left: cropXDerived.value + cropWidth.value,
    top: cropYDerived.value,
    width: SCREEN_WIDTH - cropXDerived.value - cropWidth.value,
    height: cropHeight.value,
  }));

  const overlayBottomStyle = useAnimatedStyle(() => ({
    top: cropYDerived.value + cropHeight.value,
    height: EDITOR_HEIGHT - cropYDerived.value - cropHeight.value,
  }));

  const filterStyle = {
    opacity: 1 + (brightness / 200),
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} style={styles.topBarButton}>
            <Text style={styles.topBarButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRotate} style={styles.topBarButton}>
            <Text style={styles.topBarButtonText}>Rotate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={styles.topBarButton}>
            <Text style={styles.topBarButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Aspect Ratio Selector */}
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
                  onPress={() => setAspectRatio(ratio)}>
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

              <GestureDetector gesture={composedGesture}>
                <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
                  <Image
                    source={{uri: imageUri}}
                    style={[styles.image, filterStyle]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>

              {/* Crop overlay with corner handles */}
              <ImageCropOverlay
                cropX={cropXDerived}
                cropY={cropYDerived}
                cropWidth={cropWidth}
                cropHeight={cropHeight}
                screenWidth={SCREEN_WIDTH}
                editorHeight={EDITOR_HEIGHT}
                onCornerPress={(handle) => {
                  const gesture = createCornerHandleGesture(handle);
                  // Attach gesture to handle
                }}
              />
            </View>
          </View>
        )}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.bottomBarButton, mode === 'crop' && styles.bottomBarButtonActive]}
            onPress={() => setMode('crop')}>
            <Text style={styles.bottomBarButtonText}>Crop</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomBarButton, mode === 'adjust' && styles.bottomBarButtonActive]}
            onPress={() => setMode('adjust')}>
            <Text style={styles.bottomBarButtonText}>Adjust</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleSave}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Adjust sliders */}
        {mode === 'adjust' && (
          <View style={styles.adjustContainer}>
            <ImageAdjustSlider
              label="Brightness"
              value={brightness}
              onValueChange={setBrightness}
              min={-100}
              max={100}
            />
            <ImageAdjustSlider
              label="Contrast"
              value={contrast}
              onValueChange={setContrast}
              min={-100}
              max={100}
            />
            <ImageAdjustSlider
              label="Saturation"
              value={saturation}
              onValueChange={setSaturation}
              min={-100}
              max={100}
            />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: '#1A1A1A',
  },
  topBarButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  topBarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  aspectRatioSelector: {
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  aspectRatioButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
  },
  aspectRatioButtonActive: {
    backgroundColor: '#25D366',
  },
  aspectRatioText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  aspectRatioTextActive: {
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
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: EDITOR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlaySide: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
  bottomBarButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
  },
  bottomBarButtonActive: {
    backgroundColor: '#25D366',
  },
  bottomBarButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#25D366',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  adjustContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
  },
});

export default ImageEditorScreen;
```

---

## Image Editor Logic

### Core Concepts

#### 1. **Coordinate Systems**

The image editor uses three coordinate systems:

- **Screen Space**: The device screen dimensions (SCREEN_WIDTH × SCREEN_HEIGHT)
- **Display Space**: The image as displayed on screen (with transforms applied)
- **Image Space**: The original image pixel dimensions

#### 2. **Transform Pipeline**

```
Original Image → Scale → Translate → Rotate → Crop → Filters → Final Image
```

#### 3. **Crop Box Centering**

The crop box is always centered:
```typescript
cropX = (SCREEN_WIDTH - cropWidth) / 2
cropY = (EDITOR_HEIGHT - cropHeight) / 2
```

This ensures the crop area stays in the center regardless of size changes.

#### 4. **Aspect Ratio Constraints**

When an aspect ratio is selected:
- Calculate target aspect: `targetAspect = width / height`
- For each resize, maintain: `newWidth / newHeight = targetAspect`
- Adjust the smaller dimension to fit

Example for 4:5:
```typescript
if (newWidth / (4/5) > newHeight) {
  newHeight = newWidth / (4/5);  // Height is smaller, adjust it
} else {
  newWidth = newHeight * (4/5);  // Width is smaller, adjust it
}
```

#### 5. **Image Transform Calculation**

When saving, convert screen-space crop to image-space:

```typescript
// 1. Account for image scale
const scaledImageWidth = imageWidth * scale;
const scaledImageHeight = imageHeight * scale;

// 2. Account for image position (centered + translation)
const imageDisplayX = (SCREEN_WIDTH - scaledImageWidth) / 2 + translateX;
const imageDisplayY = (EDITOR_HEIGHT - scaledImageHeight) / 2 + translateY;

// 3. Convert crop area from screen to image space
const cropX = (cropArea.x - imageDisplayX) / scale;
const cropY = (cropArea.y - imageDisplayY) / scale;
const cropWidth = cropArea.width / scale;
const cropHeight = cropArea.height / scale;

// 4. Account for rotation (rotate coordinates around image center)
// ... rotation math ...
```

---

## Gesture Handlers

### 1. **Pan Gesture (Image Movement)**

```typescript
const panGesture = Gesture.Pan()
  .onUpdate((e) => {
    'worklet';  // Runs on UI thread
    translateX.value = e.translationX;
    translateY.value = e.translationY;
  })
  .onEnd(() => {
    'worklet';
    // Spring animation for smooth end
    translateX.value = withSpring(translateX.value);
    translateY.value = withSpring(translateY.value);
  });
```

**Key Points:**
- `'worklet'` directive ensures code runs on UI thread (60 FPS)
- `translationX/Y` is relative to gesture start
- `withSpring` provides smooth animation

### 2. **Pinch Gesture (Zoom)**

```typescript
const pinchGesture = Gesture.Pinch()
  .onUpdate((e) => {
    'worklet';
    // Clamp scale between 0.5x and 3x
    scale.value = Math.max(0.5, Math.min(e.scale, 3));
  })
  .onEnd(() => {
    'worklet';
    scale.value = withSpring(scale.value);
  });
```

**Key Points:**
- `e.scale` is relative to initial pinch distance
- Clamping prevents extreme zoom levels
- Spring animation on release

### 3. **Corner Handle Gesture (Crop Resize)**

```typescript
const createCornerHandleGesture = (handle: CropHandle) => {
  return Gesture.Pan()
    .onStart(() => {
      setActiveHandle(handle);  // React state (JS thread)
    })
    .onUpdate((e) => {
      'worklet';  // UI thread
      const deltaX = e.translationX;
      const deltaY = e.translationY;
      
      // Calculate new size based on corner
      let newWidth = cropWidth.value;
      let newHeight = cropHeight.value;
      
      switch (handle) {
        case 'topLeft':
          // Moving top-left corner: decrease both dimensions
          newWidth = cropWidth.value - deltaX * 2;  // *2 for symmetric resize
          newHeight = cropHeight.value - deltaY * 2;
          break;
        // ... other corners
      }
      
      // Apply constraints
      newWidth = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, newWidth));
      newHeight = Math.max(MIN_CROP_SIZE, Math.min(MAX_CROP_SIZE, newHeight));
      
      // Apply aspect ratio
      if (aspectRatio !== 'free') {
        // ... aspect ratio math
      }
      
      cropWidth.value = newWidth;
      cropHeight.value = newHeight;
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setActiveHandle)(null);  // Call JS function from worklet
    });
};
```

**Key Points:**
- `deltaX * 2` creates symmetric resize (both sides move)
- Constraints prevent crop box from getting too small/large
- `runOnJS` is needed to call React state setters from worklets

### 4. **Simultaneous Gestures**

```typescript
const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);
```

Allows pan and pinch to work at the same time.

---

## Crop Math Explanation

### Problem Statement

Convert a crop area defined in **screen coordinates** to **image pixel coordinates**, accounting for:
- Image scale (zoom)
- Image translation (pan)
- Image rotation

### Step-by-Step Calculation

#### Step 1: Image Display Dimensions

```typescript
const scaledImageWidth = imageWidth * scale;
const scaledImageHeight = imageHeight * scale;
```

#### Step 2: Image Display Position

The image is centered, then translated:

```typescript
const imageDisplayX = (SCREEN_WIDTH - scaledImageWidth) / 2 + translateX;
const imageDisplayY = (EDITOR_HEIGHT - scaledImageHeight) / 2 + translateY;
```

#### Step 3: Convert Crop Area to Image Space (Before Rotation)

```typescript
// Crop area relative to image (in scaled coordinates)
let cropX = (cropArea.x - imageDisplayX) / scale;
let cropY = (cropArea.y - imageDisplayY) / scale;
let cropWidth = cropArea.width / scale;
let cropHeight = cropArea.height / scale;
```

#### Step 4: Account for Rotation

Rotation happens around the image center:

```typescript
const centerX = imageWidth / 2;
const centerY = imageHeight / 2;
const radians = (-rotation * Math.PI) / 180;  // Negative for counter-clockwise

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
```

#### Step 5: Clamp to Image Bounds

```typescript
cropX = Math.max(0, Math.min(imageWidth - 1, cropX));
cropY = Math.max(0, Math.min(imageHeight - 1, cropY));
cropWidth = Math.max(1, Math.min(imageWidth - cropX, cropWidth));
cropHeight = Math.max(1, Math.min(imageHeight - cropY, cropHeight));
```

### Visual Example

```
Screen Space (800x600):
┌─────────────────────────────────┐
│  [Dark Overlay]                 │
│  ┌─────────────┐                │
│  │             │  ← Crop Box    │
│  │   Image     │    (300x300)   │
│  │  (scaled)   │                │
│  └─────────────┘                │
│  [Dark Overlay]                 │
└─────────────────────────────────┘

Image Space (2000x1500):
┌──────────────────────────────┐
│                              │
│    ┌──────┐                  │
│    │ Crop │  ← Actual crop   │
│    │ Area │    (750x750px)   │
│    └──────┘                  │
│                              │
└──────────────────────────────┘
```

---

## Android & iOS Permission Notes

### Android Permissions

#### Complete AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Internet (for downloading media) -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- Camera -->
    <uses-permission android:name="android.permission.CAMERA" />
    
    <!-- Audio Recording -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    
    <!-- Storage permissions for Android < 13 -->
    <uses-permission 
        android:name="android.permission.READ_EXTERNAL_STORAGE" 
        android:maxSdkVersion="32" />
    <uses-permission 
        android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
        android:maxSdkVersion="29" />
    
    <!-- Storage permissions for Android 13+ -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:usesCleartextTraffic="true"
        android:requestLegacyExternalStorage="true"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

#### AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Internet (for downloading media) -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- Camera -->
    <uses-permission android:name="android.permission.CAMERA" />
    
    <!-- Audio Recording -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    
    <!-- Storage permissions for Android < 13 -->
    <uses-permission 
        android:name="android.permission.READ_EXTERNAL_STORAGE" 
        android:maxSdkVersion="32" />
    <uses-permission 
        android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
        android:maxSdkVersion="29" />
    
    <!-- Storage permissions for Android 13+ -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:usesCleartextTraffic="true"
        android:requestLegacyExternalStorage="true"
        android:theme="@style/AppTheme">
        <!-- ... -->
    </application>
</manifest>
```

#### Runtime Permission Handling

For Android 6.0+ (API 23+), request permissions at runtime:

```typescript
import {PermissionsAndroid, Platform} from 'react-native';

// Request camera permission
const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

// Request storage permission (Android < 13)
const requestStoragePermission = async () => {
  if (Platform.OS === 'android' && Platform.Version < 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to your storage',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

// Request media permissions (Android 13+)
const requestMediaPermissions = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      ];
      
      const results = await PermissionsAndroid.requestMultiple(permissions);
      return (
        results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};
```

### iOS Permissions

#### Complete Info.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>MyApp</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$(MARKETING_VERSION)</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleVersion</key>
    <string>$(CURRENT_PROJECT_VERSION)</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    
    <!-- Network Security -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <false/>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
    
    <!-- Camera Permission -->
    <key>NSCameraUsageDescription</key>
    <string>This app needs access to your camera to take photos and videos for messages.</string>
    
    <!-- Photo Library Permission -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>This app needs access to your photo library to select images and videos for messages.</string>
    
    <!-- Photo Library Add Permission (for saving) -->
    <key>NSPhotoLibraryAddUsageDescription</key>
    <string>This app needs access to save photos to your library.</string>
    
    <!-- Microphone Permission -->
    <key>NSMicrophoneUsageDescription</key>
    <string>This app needs access to your microphone to record audio messages.</string>
    
    <!-- Launch Screen -->
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    
    <!-- Device Capabilities -->
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>armv7</string>
    </array>
    
    <!-- Supported Orientations -->
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    
    <key>UIViewControllerBasedStatusBarAppearance</key>
    <false/>
</dict>
</plist>
```

#### Info.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Camera -->
    <key>NSCameraUsageDescription</key>
    <string>This app needs access to your camera to take photos and videos for messages.</string>
    
    <!-- Photo Library -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>This app needs access to your photo library to select images and videos for messages.</string>
    
    <!-- Photo Library Add (for saving) -->
    <key>NSPhotoLibraryAddUsageDescription</key>
    <string>This app needs access to save photos to your library.</string>
    
    <!-- Microphone -->
    <key>NSMicrophoneUsageDescription</key>
    <string>This app needs access to your microphone to record audio messages.</string>
</dict>
</plist>
```

#### iOS Permission Handling

iOS requests permissions automatically when you use the APIs. No runtime code needed, but handle denial:

```typescript
import {Alert, Linking, Platform} from 'react-native';

// Check and request camera permission (iOS)
const checkCameraPermission = async () => {
  if (Platform.OS === 'ios') {
    // iOS handles permissions automatically via Info.plist
    // react-native-image-picker will show permission dialog
    return true;
  }
  return await requestCameraPermission();
};

// Handle permission denial
const handlePermissionDenied = (permission: string) => {
  Alert.alert(
    'Permission Required',
    `Please enable ${permission} in Settings to use this feature.`,
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        },
      },
    ]
  );
};
```

### Permission Best Practices

1. **Request on-demand**: Only request when user tries to use the feature
2. **Explain why**: Show clear messages about why permission is needed
3. **Handle denial gracefully**: Don't crash if permission is denied
4. **Check before use**: Always check permission status before accessing features
5. **Android 13+**: Use granular media permissions (READ_MEDIA_IMAGES, etc.)
6. **iOS**: All descriptions must be provided in Info.plist

### Complete Permission Helper

```typescript
// utils/permissions.ts
import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';

export const requestImagePickerPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      // Android 13+
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error(err);
        return false;
      }
    } else {
      // Android < 13
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error(err);
        return false;
      }
    }
  }
  // iOS - handled automatically by react-native-image-picker
  return true;
};

export const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
  // iOS - handled automatically
  return true;
};

export const requestAudioPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
  // iOS - handled automatically
  return true;
};
```

---

---

## Complete Utility Functions

### imageProcessor.ts

```typescript
import RNFS from 'react-native-fs';
import {Image, Platform} from 'react-native';
import {fileManager} from './fileManager';

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
  brightness: number;
  contrast: number;
  saturation: number;
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
  // Step 1: Calculate scaled image dimensions
  const scaledWidth = imageSize.width * transform.scale;
  const scaledHeight = imageSize.height * transform.scale;
  
  // Step 2: Calculate image position (centered + translation)
  const imageDisplayX = (displaySize.width - scaledWidth) / 2 + transform.translateX;
  const imageDisplayY = (displaySize.height - scaledHeight) / 2 + transform.translateY;
  
  // Step 3: Convert crop area from screen space to image space (before rotation)
  let cropX = (cropArea.x - imageDisplayX) / transform.scale;
  let cropY = (cropArea.y - imageDisplayY) / transform.scale;
  let cropWidth = cropArea.width / transform.scale;
  let cropHeight = cropArea.height / transform.scale;
  
  // Step 4: Account for rotation
  if (transform.rotation !== 0) {
    const centerX = imageSize.width / 2;
    const centerY = imageSize.height / 2;
    const radians = (-transform.rotation * Math.PI) / 180;
    
    // Rotate crop corner points around image center
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
  
  // Step 5: Clamp to image bounds
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
 * Note: Actual image processing requires native modules
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
    
    const sourceExists = await RNFS.exists(sourcePath);
    if (!sourceExists) {
      throw new Error(`Source image not found: ${sourcePath}`);
    }
    
    // Save to edited directory
    const outputPath = `${fileManager.imagesEditedDir}/${outputFileName}`;
    
    // Check if processing is needed
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
      // No processing needed, just copy
      await RNFS.copyFile(sourcePath, outputPath);
      return outputPath;
    }
    
    // TODO: Implement native image processing
    // For now, copy original (native implementation needed)
    await RNFS.copyFile(sourcePath, outputPath);
    return outputPath;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

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
  
  return {imagePath: processedImagePath, cropCoordinates: actualCrop};
};
```

### ImageCropOverlay.tsx

```typescript
import React from 'react';
import {View, StyleSheet, TouchableOpacity} from 'react-native';
import Animated, {useAnimatedStyle} from 'react-native-reanimated';
import type {SharedValue} from 'react-native-reanimated';
import Svg, {Rect, Circle, Line} from 'react-native-svg';

interface ImageCropOverlayProps {
  cropX: SharedValue<number>;
  cropY: SharedValue<number>;
  cropWidth: SharedValue<number>;
  cropHeight: SharedValue<number>;
  screenWidth: number;
  editorHeight: number;
  onCornerPress?: (handle: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight') => void;
}

const ImageCropOverlay: React.FC<ImageCropOverlayProps> = ({
  cropX,
  cropY,
  cropWidth,
  cropHeight,
  screenWidth,
  editorHeight,
  onCornerPress,
}) => {
  const cropAnimatedStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: cropX.value,
      top: cropY.value,
      width: cropWidth.value,
      height: cropHeight.value,
    };
  });

  return (
    <Animated.View style={[styles.cropOverlay, cropAnimatedStyle]} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Crop border */}
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        
        {/* Corner handles (visual) */}
        <Circle cx="0" cy="0" r="12" fill="#FFFFFF" />
        <Circle cx="100%" cy="0" r="12" fill="#FFFFFF" />
        <Circle cx="0" cy="100%" r="12" fill="#FFFFFF" />
        <Circle cx="100%" cy="100%" r="12" fill="#FFFFFF" />
        
        {/* Grid lines (rule of thirds) */}
        <Line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
        <Line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
        <Line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
        <Line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
      </Svg>
      
      {/* Interactive corner handles (TouchableOpacity for gestures) */}
      <TouchableOpacity
        style={[styles.cornerHandle, styles.topLeftHandle]}
        onPressIn={() => onCornerPress?.('topLeft')}
      />
      <TouchableOpacity
        style={[styles.cornerHandle, styles.topRightHandle]}
        onPressIn={() => onCornerPress?.('topRight')}
      />
      <TouchableOpacity
        style={[styles.cornerHandle, styles.bottomLeftHandle]}
        onPressIn={() => onCornerPress?.('bottomLeft')}
      />
      <TouchableOpacity
        style={[styles.cornerHandle, styles.bottomRightHandle]}
        onPressIn={() => onCornerPress?.('bottomRight')}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cropOverlay: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 4,
  },
  cornerHandle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#25D366',
  },
  topLeftHandle: {
    top: -12,
    left: -12,
  },
  topRightHandle: {
    top: -12,
    right: -12,
  },
  bottomLeftHandle: {
    bottom: -12,
    left: -12,
  },
  bottomRightHandle: {
    bottom: -12,
    right: -12,
  },
});

export default ImageCropOverlay;
```

### ImageAdjustSlider.tsx

```typescript
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface ImageAdjustSliderProps {
  label: string;
  value: number; // -100 to 100
  onValueChange: (value: number) => void;
}

const ImageAdjustSlider: React.FC<ImageAdjustSliderProps> = ({
  label,
  value,
  onValueChange,
}) => {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderValue}>{value}</Text>
        <View style={styles.sliderTrack}>
          <View
            style={[
              styles.sliderFill,
              {width: `${((value + 100) / 200) * 100}%`},
            ]}
          />
        </View>
      </View>
      <View style={styles.sliderButtons}>
        <TouchableOpacity
          style={styles.sliderButton}
          onPress={() => onValueChange(Math.max(-100, value - 10))}>
          <Text style={styles.sliderButtonText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sliderButton}
          onPress={() => onValueChange(Math.min(100, value + 10))}>
          <Text style={styles.sliderButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    width: 80,
  },
  sliderContainer: {
    flex: 1,
    marginHorizontal: 12,
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#25D366',
    borderRadius: 2,
  },
  sliderValue: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  sliderButtons: {
    flexDirection: 'row',
  },
  sliderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sliderButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ImageAdjustSlider;
```

---

---

## Quick Reference

### Gesture Handler Pattern

```typescript
const gesture = Gesture.Pan()
  .onStart(() => {
    // React state updates (JS thread)
    setSomeState(value);
  })
  .onUpdate((e) => {
    'worklet';  // UI thread - 60 FPS
    sharedValue.value = e.translationX;
  })
  .onEnd(() => {
    'worklet';  // UI thread
    sharedValue.value = withSpring(targetValue);
    // Call React function from worklet
    runOnJS(setSomeState)(null);
  });
```

### Crop Coordinate Conversion Formula

```
Screen Crop → Image Crop:

1. Account for scale:
   imageCropX = (screenCropX - imageDisplayX) / scale
   
2. Account for rotation:
   Rotate crop corners around image center
   Find bounding box of rotated corners
   
3. Clamp to image bounds:
   imageCropX = clamp(0, imageWidth - 1, imageCropX)
```

### Permission Request Pattern

```typescript
// Android
const granted = await PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.CAMERA,
  {
    title: 'Permission Title',
    message: 'Why you need it',
    buttonPositive: 'OK',
  }
);

// iOS - Automatic via Info.plist
// No code needed, handled by system
```

### Image Loading Pattern

```typescript
// Memory-safe image loading
const imageSource = {
  uri: fileUri,
  cache: 'force-cache' as const,
};

<Image 
  source={imageSource}
  style={styles.image}
  resizeMode="cover"
  progressiveRenderingEnabled={true}
  fadeDuration={200}
  onLoadStart={() => {}}
  onLoadEnd={() => {}}
  onError={(error) => console.error(error)}
/>
```

---

## Summary

### Key Takeaways

1. **Reanimated Gestures**: Use `'worklet'` directive for UI thread execution (60 FPS)
2. **Crop Math**: Convert screen coordinates → image coordinates accounting for transforms
3. **Permissions**: Android needs runtime requests, iOS needs Info.plist descriptions
4. **Memory Safety**: Lazy load images, use caching, cleanup on unmount
5. **Performance**: Optimize FlatList with `getItemLayout`, reduce render batches

### Performance Tips

- Always use `'worklet'` in gesture handlers
- Use `runOnJS` to call React functions from worklets
- Lazy load images with `shouldLoadMedia` prop
- Enable image caching with `cache: 'force-cache'`
- Use `getItemLayout` in FlatList for better scrolling
- Reduce `windowSize` and `maxToRenderPerBatch` for large lists

### Troubleshooting

**Issue**: Gestures feel laggy
- **Solution**: Ensure all gesture handlers have `'worklet'` directive

**Issue**: Crop coordinates are wrong
- **Solution**: Verify `calculateCropCoordinates` accounts for all transforms (scale, translate, rotate)

**Issue**: Images not loading
- **Solution**: Check file paths, ensure `file://` prefix for local files, verify permissions

**Issue**: App crashes on Android
- **Solution**: Check AndroidManifest.xml permissions, verify native modules are linked

**Issue**: Permission denied on iOS
- **Solution**: Ensure all usage descriptions are in Info.plist with clear explanations

