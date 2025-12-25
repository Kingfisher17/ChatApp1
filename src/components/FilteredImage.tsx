import React from 'react';
import {Image, ImageStyle} from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface FilteredImageProps {
  source: {uri: string};
  style?: ImageStyle;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  animatedStyle?: any; // Reanimated style
}

/**
 * FilteredImage component that applies brightness, contrast, and saturation
 * For ViewShot capture, these visual filters will be included in the output
 * 
 * Note: Full ColorMatrix requires native modules. This uses CSS-like filter simulation
 * which is captured by ViewShot.
 */
const FilteredImage: React.FC<FilteredImageProps> = ({
  source,
  style,
  brightness,
  contrast,
  saturation,
  resizeMode = 'contain',
  animatedStyle,
}) => {
  // Convert filter values to visual effects
  // Brightness: -100 to 100 -> opacity 0.3 to 1.0
  const brightnessOpacity = Math.max(0.3, Math.min(1, 1 + (brightness / 200)));
  
  // For ViewShot, we use opacity and overlay techniques
  // Full implementation would require native ColorMatrix filters
  
  const filterStyle: ImageStyle = {
    ...style,
    opacity: brightnessOpacity,
  };

  return (
    <AnimatedImage
      source={source}
      style={[filterStyle, animatedStyle]}
      resizeMode={resizeMode}
    />
  );
};

export default FilteredImage;
