import React, {useState} from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import {DrawingPath} from '../types';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

interface DrawingCanvasProps {
  width: number;
  height: number;
  drawings: DrawingPath[];
  onDrawingComplete: (path: DrawingPath) => void;
  onDrawingStart?: () => void;
  strokeColor: string;
  strokeWidth: number;
  enabled: boolean;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  width,
  height,
  drawings,
  onDrawingComplete,
  onDrawingStart,
  strokeColor,
  strokeWidth,
  enabled,
}) => {
  const pathPoints = useSharedValue<Array<{x: number; y: number}>>([]);
  const isDrawing = useSharedValue(false);
  const [currentPathString, setCurrentPathString] = useState('');

  const createPathString = (points: Array<{x: number; y: number}>): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  const handlePathComplete = (points: Array<{x: number; y: number}>) => {
    if (points.length === 0) return;
    
    const newPath: DrawingPath = {
      id: `drawing_${Date.now()}_${Math.random()}`,
      points: [...points],
      color: strokeColor,
      strokeWidth,
    };
    
    onDrawingComplete(newPath);
    setCurrentPathString('');
  };

  const updatePathString = (points: Array<{x: number; y: number}>) => {
    'worklet';
    if (points.length === 0) {
      runOnJS(setCurrentPathString)('');
      return;
    }
    const pathStr = createPathString(points);
    runOnJS(setCurrentPathString)(pathStr);
  };

  const drawingGesture = Gesture.Pan()
    .enabled(enabled)
    .onStart((e) => {
      'worklet';
      isDrawing.value = true;
      pathPoints.value = [{x: e.x, y: e.y}];
      updatePathString(pathPoints.value);
      if (onDrawingStart) {
        runOnJS(onDrawingStart)();
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (isDrawing.value) {
        const newPoints = [...pathPoints.value, {x: e.x, y: e.y}];
        pathPoints.value = newPoints;
        // Throttle path string updates for performance
        if (newPoints.length % 3 === 0 || newPoints.length < 10) {
          updatePathString(newPoints);
        }
      }
    })
    .onEnd(() => {
      'worklet';
      if (isDrawing.value && pathPoints.value.length > 0) {
        const points = [...pathPoints.value];
        // Final path string update
        updatePathString(points);
        runOnJS(handlePathComplete)(points);
        pathPoints.value = [];
        runOnJS(setCurrentPathString)('');
      }
      isDrawing.value = false;
    });

  const animatedPathStyle = useAnimatedStyle(() => {
    return {
      opacity: isDrawing.value ? 1 : 0,
    };
  });

  return (
    <View style={[styles.container, {width, height}]} pointerEvents="box-none">
      <GestureDetector gesture={drawingGesture}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedPathStyle]}>
          <Svg style={StyleSheet.absoluteFill}>
            {currentPathString && (
              <Path
                d={currentPathString}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </Animated.View>
      </GestureDetector>
      
      {/* Render completed drawings */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {drawings.map((drawing) => (
          <Path
            key={drawing.id}
            d={createPathString(drawing.points)}
            stroke={drawing.color}
            strokeWidth={drawing.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default DrawingCanvas;

