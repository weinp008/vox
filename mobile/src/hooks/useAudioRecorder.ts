import { useState, useRef } from 'react';
import { Audio } from 'expo-av';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  async function startRecording() {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    recordingRef.current = recording;
    setIsRecording(true);
  }

  async function stopRecording(): Promise<string> {
    const recording = recordingRef.current;
    if (!recording) throw new Error('No active recording');

    setIsRecording(false);
    await recording.stopAndUnloadAsync();

    // Switch back so playback routes through speaker, not earpiece
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const uri = recording.getURI();
    recordingRef.current = null;

    if (!uri) throw new Error('Recording URI is null');
    return uri;
  }

  return { startRecording, stopRecording, isRecording };
}
