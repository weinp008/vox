import { useState, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const WORDS_PER_SECOND = 2.8; // Approximate TTS speaking rate

export function useAudioPlayer(onFinish: () => void) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastBase64Ref = useRef<string | null>(null);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordCountRef = useRef(0);

  function startWordTracking(text: string) {
    const words = text.split(/\s+/).filter(Boolean);
    wordCountRef.current = words.length;
    setCurrentWordIndex(0);

    if (wordTimerRef.current) clearInterval(wordTimerRef.current);

    const msPerWord = 1000 / WORDS_PER_SECOND;
    let idx = 0;
    wordTimerRef.current = setInterval(() => {
      idx++;
      if (idx >= words.length) {
        if (wordTimerRef.current) clearInterval(wordTimerRef.current);
        setCurrentWordIndex(-1);
        return;
      }
      setCurrentWordIndex(idx);
    }, msPerWord);
  }

  function stopWordTracking() {
    if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    wordTimerRef.current = null;
    setCurrentWordIndex(-1);
  }

  const playAudio = useCallback(async (base64: string, textForHighlighting?: string) => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    stopWordTracking();

    lastBase64Ref.current = base64;

    const path = FileSystem.cacheDirectory + 'vox_tts.mp3';
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: path },
      { shouldPlay: true },
      (status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          stopWordTracking();
          onFinish();
        }
      },
    );

    soundRef.current = sound;
    setIsPlaying(true);

    if (textForHighlighting) {
      startWordTracking(textForHighlighting);
    }
  }, [onFinish]);

  async function stopAudio() {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    stopWordTracking();
    setIsPlaying(false);
  }

  async function replayAudio(): Promise<boolean> {
    if (!lastBase64Ref.current) return false;
    await playAudio(lastBase64Ref.current);
    return true;
  }

  return { playAudio, stopAudio, replayAudio, isPlaying, currentWordIndex };
}
