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


