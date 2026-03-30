import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UIState } from '../types';

interface Props {
  uiState: UIState;
  onPressIn: () => void;
  onPressOut: () => void;
  onStopAudio: () => void;
  onDoubleTapReplay: () => void;
}

const DOUBLE_TAP_MS = 300;

export function RecordButton({ uiState, onPressIn, onPressOut, onStopAudio, onDoubleTapReplay }: Props) {
  const isRecording = uiState === 'recording';
  const isListening = uiState === 'listening';
  const isProcessing = uiState === 'processing';
  const lastTapRef = useRef<number>(0);

  function handlePressIn() {
    if (isListening) {
      onStopAudio();
      return;
    }
    if (isProcessing) return;

    // Detect double-tap when idle → replay last audio
    const now = Date.now();
    if (uiState === 'idle' && now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0; // Reset so triple-tap doesn't re-trigger
      onDoubleTapReplay();
      return;
    }
    lastTapRef.current = now;

    onPressIn();
  }

  function handlePressOut() {
    if (isListening || isProcessing) return;
    onPressOut();
  }

  const label = isRecording
    ? 'Release to send'
    : isListening
      ? 'Tap to stop'
      : isProcessing
        ? '...'
        : 'Hold to speak';

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.button,
        isRecording && styles.buttonRecording,
        isListening && styles.buttonListening,
        isProcessing && styles.buttonDisabled,
      ]}
    >
      <View style={styles.inner}>
        <Text style={styles.icon}>
          {isRecording ? '\u23F9' : isListening ? '\u23F8' : '\uD83C\uDF99'}
        </Text>
        <Text style={styles.label}>{label}</Text>
        {uiState === 'idle' && (
          <Text style={styles.hint}>Double-tap to replay</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#1a2744',
    borderWidth: 3,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRecording: {
    backgroundColor: '#3d0f0f',
    borderColor: '#ff4444',
  },
  buttonListening: {
    backgroundColor: '#0a2a3d',
    borderColor: '#00d4ff',
  },
  buttonDisabled: {
    borderColor: '#334',
    opacity: 0.5,
  },
  inner: { alignItems: 'center', gap: 4 },
  icon: { fontSize: 40 },
  label: { color: '#aac', fontSize: 13, textAlign: 'center' },
  hint: { color: '#334', fontSize: 10, textAlign: 'center' },
});
