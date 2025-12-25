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
  }, []);

  return (
    <Animated.View style={[styles.cropOverlay, cropAnimatedStyle]} pointerEvents="box-none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Premium thin white crop border (1px) */}
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1"
        />
        
        {/* Subtle white corner handles */}
        <Circle cx="0" cy="0" r="8" fill="#FFFFFF" opacity="0.9" />
        <Circle cx="100%" cy="0" r="8" fill="#FFFFFF" opacity="0.9" />
        <Circle cx="0" cy="100%" r="8" fill="#FFFFFF" opacity="0.9" />
        <Circle cx="100%" cy="100%" r="8" fill="#FFFFFF" opacity="0.9" />
        
        {/* 3x3 Grid lines (only visible during resize) */}
        <Line x1="33.33%" y1="0" x2="33.33%" y2="100%" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.4" />
        <Line x1="66.66%" y1="0" x2="66.66%" y2="100%" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.4" />
        <Line x1="0" y1="33.33%" x2="100%" y2="33.33%" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.4" />
        <Line x1="0" y1="66.66%" x2="100%" y2="66.66%" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.4" />
      </Svg>
      
      {/* Interactive corner handles (larger touch targets) */}
      <TouchableOpacity
        style={[styles.cornerHandle, styles.topLeftHandle]}
        onPressIn={() => onCornerPress?.('topLeft')}
        activeOpacity={0.7}
      />
      <TouchableOpacity
        style={[styles.cornerHandle, styles.topRightHandle]}
        onPressIn={() => onCornerPress?.('topRight')}
        activeOpacity={0.7}
      />
      <TouchableOpacity
        style={[styles.cornerHandle, styles.bottomLeftHandle]}
        onPressIn={() => onCornerPress?.('bottomLeft')}
        activeOpacity={0.7}
      />
      <TouchableOpacity
        style={[styles.cornerHandle, styles.bottomRightHandle]}
        onPressIn={() => onCornerPress?.('bottomRight')}
        activeOpacity={0.7}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cropOverlay: {
    // No border - using SVG for premium look
  },
  cornerHandle: {
    position: 'absolute',
    width: 32, // Larger touch target
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent', // Invisible, just for touch
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

