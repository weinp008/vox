import { useState, useRef } from 'react';
import { Audio } from 'expo-av';

const MIN_RECORDING_MS = 500; // Recordings shorter than this are treated as accidental

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTimeRef = useRef<number>(0);

  async function startRecording() {
    // Clean up any previous recording that wasn't fully released
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Already stopped, ignore
      }
      recordingRef.current = null;
    }

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
    startTimeRef.current = Date.now();
    setIsRecording(true);
  }

  /** Stop recording and return the URI, or null if it was too short (cancelled). */
  async function stopRecording(): Promise<string | null> {
    const recording = recordingRef.current;
    if (!recording) return null;

    const duration = Date.now() - startTimeRef.current;
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // Already stopped
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    const uri = recording.getURI();
    recordingRef.current = null;

    // Short press = accidental tap, cancel the recording
    if (duration < MIN_RECORDING_MS) {
      return null;
    }

    if (!uri) throw new Error('Recording URI is null');
    return uri;
  }

  return { startRecording, stopRecording, isRecording };
}
