# Crop Rectangle Aspect Ratio Lock Implementation

## Overview

The crop rectangle now supports aspect ratio locking (1:1, 4:5, 16:9) while maintaining corner-only resizing with smooth animations.

## How It Works

### 1. Aspect Ratio Constraint During Corner Resize

When a corner handle is dragged and an aspect ratio is locked, the system:

1. **Determines Primary Dimension**: Uses the dimension with the larger drag delta (deltaX vs deltaY) as the primary dimension
2. **Calculates Secondary Dimension**: Computes the other dimension using the locked aspect ratio
3. **Maintains Fixed Corner**: Adjusts the position (x, y) to keep the opposite corner fixed

**Example - Top-Left Corner Drag:**
- Bottom-right corner stays fixed
- If dragging primarily horizontally: `newWidth = baseWidth + deltaX`, then `newHeight = newWidth / aspectRatio`
- Adjusts `newY` upward to keep bottom-right corner fixed

### 2. Aspect Ratio Selection

When user selects a new aspect ratio from the toolbar:

1. **Maintains Center**: Calculates current center point of crop rectangle
2. **Recalculates Dimensions**: Determines new width/height maintaining aspect ratio
3. **Clamps to Bounds**: Ensures crop stays within editor bounds
4. **Repositions**: Centers the new crop rectangle at the same center point
5. **Smooth Animation**: Uses `withSpring` for smooth transition

### 3. Supported Aspect Ratios

- **Free**: No constraint, rectangle can be any size
- **1:1**: Square (width = height)
- **4:5**: Portrait (width/height = 0.8)
- **16:9**: Landscape (width/height = 1.778)

## Key Features

✅ **Corner-Only Resize**: Only 4 corner handles, no edge dragging
✅ **Opposite Corner Fixed**: Dragging a corner keeps the opposite corner stationary
✅ **Smooth Animations**: Reanimated springs for all position/size changes
✅ **Boundary Clamping**: Crop rectangle always stays within editor bounds
✅ **Minimum Size**: Enforced minimum crop size (MIN_CROP_SIZE = 100px)
✅ **Accumulation**: Gestures accumulate correctly (no reset on each drag)

## Code Structure

### Corner Resize Gesture (`createCornerHandleGesture`)
- Stores initial cropRect values in base shared values on gesture start
- Calculates new cropRect based on drag delta and corner being dragged
- Applies aspect ratio constraint if locked
- Clamps to bounds
- Updates all shared values (x, y, width, height)

### Aspect Ratio Update (`updateCropForAspectRatio`)
- Called when aspect ratio selection changes
- Maintains center position
- Recalculates dimensions
- Animates smoothly to new size

## UI/UX

- Premium thin 1px white border
- Subtle white corner handles (8px radius, 90% opacity)
- 3x3 grid visible during resize
- Dark translucent overlay (70% opacity) outside crop area
- Clean, WhatsApp-like appearance


