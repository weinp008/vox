import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UIState } from '../types';

interface Props {
  uiState: UIState;
  onPressIn: () => void;
  onPressOut: () => void;
  onTapInterrupt: () => void;
}

export function RecordButton({ uiState, onPressIn, onPressOut, onTapInterrupt }: Props) {
  const isRecording = uiState === 'recording';
  const isListening = uiState === 'listening';
  const isProcessing = uiState === 'processing';

  function handlePressIn() {
    if (isListening) {
      onTapInterrupt();
      return;
    }
    if (isProcessing) return;
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
  inner: { alignItems: 'center', gap: 8 },
  icon: { fontSize: 40 },
  label: { color: '#aac', fontSize: 13, textAlign: 'center' },
});
