import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

interface AudioPlayerProps {
  isPlaying: boolean;
  fileName?: string;
  onPlayPause: () => void;
  textStyle?: any;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isPlaying,
  fileName,
  onPlayPause,
  textStyle,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={onPlayPause}>
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <View style={styles.info}>
        <Text style={[textStyle, styles.title]}>Audio Message</Text>
        {fileName && (
          <Text style={[textStyle, styles.fileName]} numberOfLines={1}>
            {fileName}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    minWidth: 200,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playIcon: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileName: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default AudioPlayer;


