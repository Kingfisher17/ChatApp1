# Native Image Cropping Limitation

## Issue

There is **no React Native package** that supports programmatic image cropping with pixel coordinates. All available packages require UI interaction:

- `react-native-image-crop-picker` - Requires `openCropper()` UI
- `react-native-image-resizer` - Only resizes, doesn't crop with offset
- `@react-native-community/image-editor` - **Does not exist** (no such package)

## Current Solution

We use `react-native-view-shot` to capture the crop area. This works correctly when:
1. All transforms (scale, translate, rotate) are properly applied
2. ViewShot is positioned exactly over the crop area
3. The coordinate conversion math is accurate

**ViewShot captures what's displayed**, so if transforms are correct, the result matches the preview.

## Production Solution

For true native pixel-level cropping, create a **custom native module**:

### Android Implementation
```kotlin
// Use Bitmap.createBitmap() with crop coordinates
val croppedBitmap = Bitmap.createBitmap(
    originalBitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight
)
```

### iOS Implementation  
```swift
// Use CGImageCreateWithImageInRect() with crop coordinates
let croppedCGImage = originalCGImage.cropping(to: CGRect(
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight
))
```

## Recommendation

For now, **ViewShot is acceptable** because:
- It's accurate when transforms are correctly applied
- The coordinate conversion ensures proper mapping
- Result matches preview exactly
- No quality loss (captures at display resolution)

For production apps requiring absolute pixel accuracy, implement the native module above.


