import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export function useAudioPlayer(onFinish: () => void) {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  async function playAudio(base64: string) {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    // expo-av can't play from a data URI — write base64 to a temp file
    const path = FileSystem.cacheDirectory + 'sonar_tts.mp3';
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: path },
      { shouldPlay: true },
      (status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          onFinish();
        }
      },
    );

    soundRef.current = sound;
    setIsPlaying(true);
  }

  async function stopAudio() {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
  }

  return { playAudio, stopAudio, isPlaying };
}
