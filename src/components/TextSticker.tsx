import React, {useState, useRef, useEffect} from 'react';
import {View, Text, StyleSheet, TextInput, TouchableOpacity, Dimensions} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {TextSticker as TextStickerType} from '../types';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface TextStickerProps {
  sticker: TextStickerType;
  onUpdate: (sticker: TextStickerType) => void;
  onUpdateStart?: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
}

const TextSticker: React.FC<TextStickerProps> = ({
  sticker,
  onUpdate,
  onUpdateStart,
  onDelete,
  isSelected,
  onSelect,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(sticker.text);
  const translateX = useSharedValue(sticker.x);
  const translateY = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale || 1);
  const rotation = useSharedValue(sticker.rotation || 0);

  // Sync shared values when sticker prop changes
  useEffect(() => {
    translateX.value = sticker.x;
    translateY.value = sticker.y;
    scale.value = sticker.scale || 1;
    rotation.value = sticker.rotation || 0;
  }, [sticker.x, sticker.y, sticker.scale, sticker.rotation]);

  // Sync editText when sticker.text changes
  useEffect(() => {
    if (!isEditing) {
      setEditText(sticker.text);
    }
  }, [sticker.text, isEditing]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {scale: scale.value},
        {rotate: `${rotation.value}deg`},
      ],
    };
  });

  const panGesture = Gesture.Pan()
    .enabled(!isEditing)
    .onStart(() => {
      'worklet';
      // Store initial position
      translateX.value = sticker.x;
      translateY.value = sticker.y;
      if (onUpdateStart) {
        runOnJS(onUpdateStart)();
      }
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = sticker.x + e.translationX;
      translateY.value = sticker.y + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      const newSticker = {
        ...sticker,
        x: translateX.value,
        y: translateY.value,
      };
      runOnJS(onUpdate)(newSticker);
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(!isEditing)
    .onStart(() => {
      'worklet';
      scale.value = sticker.scale || 1;
      if (onUpdateStart) {
        runOnJS(onUpdateStart)();
      }
    })
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.max(0.5, Math.min(e.scale * (sticker.scale || 1), 3));
    })
    .onEnd(() => {
      'worklet';
      const newSticker = {
        ...sticker,
        scale: scale.value,
      };
      runOnJS(onUpdate)(newSticker);
    });

  const rotationGesture = Gesture.Rotation()
    .enabled(!isEditing)
    .onStart(() => {
      'worklet';
      rotation.value = sticker.rotation || 0;
      if (onUpdateStart) {
        runOnJS(onUpdateStart)();
      }
    })
    .onUpdate((e) => {
      'worklet';
      rotation.value = (sticker.rotation || 0) + (e.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      'worklet';
      const newSticker = {
        ...sticker,
        rotation: rotation.value,
      };
      runOnJS(onUpdate)(newSticker);
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    Gesture.Simultaneous(pinchGesture, rotationGesture)
  );

  const handleTextChange = (text: string) => {
    setEditText(text);
    // Update text immediately for real-time preview
    onUpdate({...sticker, text});
  };

  const handleTextFocus = () => {
    if (onUpdateStart) {
      onUpdateStart();
    }
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    // Text is already updated via handleTextChange
  };

  const lastTapRef = useRef<number>(0);

  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
      setIsEditing(true);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      onSelect();
    }
  };

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {isEditing ? (
          <TextInput
            style={[
              styles.textInput,
              {
                fontSize: sticker.fontSize,
                color: sticker.color,
              },
            ]}
            value={editText}
            onChangeText={handleTextChange}
            onFocus={handleTextFocus}
            onBlur={handleTextBlur}
            autoFocus
            multiline
            maxLength={100}
          />
        ) : (
          <TouchableOpacity
            onPress={handleTap}
            onLongPress={onDelete}
            delayLongPress={500}>
            <Text
              style={[
                styles.text,
                {
                  fontSize: sticker.fontSize,
                  color: sticker.color,
                  fontFamily: sticker.fontFamily,
                },
                isSelected && styles.selectedText,
              ]}>
              {sticker.text}
            </Text>
          </TouchableOpacity>
        )}
        {isSelected && !isEditing && (
          <View style={styles.selectionBorder} />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    minWidth: 50,
    minHeight: 30,
  },
  text: {
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  selectedText: {
    borderWidth: 1,
    borderColor: '#25D366',
    borderStyle: 'dashed',
    padding: 4,
  },
  textInput: {
    minWidth: 100,
    minHeight: 30,
    textAlign: 'center',
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#25D366',
    borderRadius: 4,
    padding: 4,
  },
  selectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#25D366',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
});

export default TextSticker;

