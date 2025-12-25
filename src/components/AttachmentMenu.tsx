import React from 'react';
import {Alert} from 'react-native';

interface AttachmentMenuProps {
  onSelectImage: () => void;
  onSelectVideo: () => void;
  onSelectAudio: () => void;
  onSelectFile: () => void;
}

export const showAttachmentMenu = ({
  onSelectImage,
  onSelectVideo,
  onSelectAudio,
  onSelectFile,
}: AttachmentMenuProps): void => {
  Alert.alert(
    'Attach Media',
    'Choose an option',
    [
      {text: '📷 Image', onPress: onSelectImage},
      {text: '🎥 Video', onPress: onSelectVideo},
      {text: '🎤 Audio', onPress: onSelectAudio},
      {text: '📎 File', onPress: onSelectFile},
      {text: 'Cancel', style: 'cancel'},
    ]
  );
};


