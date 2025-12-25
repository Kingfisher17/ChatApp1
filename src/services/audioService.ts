import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

class AudioService {
  private audioRecorderPlayer: AudioRecorderPlayer;
  private currentRecordingPath: string | null = null;

  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
  }

  async startRecording(): Promise<string> {
    try {
      const path = `${RNFS.DocumentDirectoryPath}/audio_${Date.now()}.m4a`;
      const result = await this.audioRecorderPlayer.startRecorder(path);
      this.currentRecordingPath = result;
      return result;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string> {
    try {
      const result = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();
      const recordingPath = this.currentRecordingPath || result;
      this.currentRecordingPath = null;
      return recordingPath;
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }

  async playAudio(path: string): Promise<void> {
    try {
      await this.audioRecorderPlayer.startPlayer(path);
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }

  async stopAudio(): Promise<void> {
    try {
      await this.audioRecorderPlayer.stopPlayer();
      this.audioRecorderPlayer.removePlayBackListener();
    } catch (error) {
      console.error('Error stopping audio:', error);
      throw error;
    }
  }

  async pauseAudio(): Promise<void> {
    try {
      await this.audioRecorderPlayer.pausePlayer();
    } catch (error) {
      console.error('Error pausing audio:', error);
      throw error;
    }
  }

  async resumeAudio(): Promise<void> {
    try {
      await this.audioRecorderPlayer.resumePlayer();
    } catch (error) {
      console.error('Error resuming audio:', error);
      throw error;
    }
  }

  getDuration(path: string): Promise<number> {
    return this.audioRecorderPlayer.getDuration(path);
  }

  addRecordBackListener(callback: (e: any) => void): void {
    this.audioRecorderPlayer.addRecordBackListener(callback);
  }

  addPlayBackListener(callback: (e: any) => void): void {
    this.audioRecorderPlayer.addPlayBackListener(callback);
  }
}

export const audioService = new AudioService();


