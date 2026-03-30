import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UIState } from '../types';

interface Props {
  uiState: UIState;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function RecordButton({ uiState, onPressIn, onPressOut }: Props) {
  const disabled = uiState === 'processing' || uiState === 'listening';
  const isRecording = uiState === 'recording';

  return (
    <Pressable
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      style={[styles.button, isRecording && styles.buttonRecording, disabled && styles.buttonDisabled]}
    >
      <View style={styles.inner}>
        <Text style={styles.icon}>{isRecording ? '\u23F9' : '\uD83C\uDF99'}</Text>
        <Text style={styles.label}>
          {isRecording ? 'Release to send' : disabled ? '...' : 'Hold to speak'}
        </Text>
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
  buttonDisabled: {
    borderColor: '#334',
    opacity: 0.5,
  },
  inner: { alignItems: 'center', gap: 8 },
  icon: { fontSize: 40 },
  label: { color: '#aac', fontSize: 13, textAlign: 'center' },
});
