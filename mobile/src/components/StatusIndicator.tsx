import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { UIState } from '../types';

const STATE_CONFIG: Record<UIState, { color: string; label: string }> = {
  idle: { color: '#334466', label: 'Ready' },
  recording: { color: '#ff4444', label: 'Recording' },
  processing: { color: '#ffaa00', label: 'Processing' },
  listening: { color: '#00d4ff', label: 'Listening' },
};

export function StatusIndicator({ uiState }: { uiState: UIState }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const { color, label } = STATE_CONFIG[uiState];
  const shouldPulse = uiState === 'recording' || uiState === 'listening';

  useEffect(() => {
    if (shouldPulse) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [shouldPulse]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, { borderColor: color, transform: [{ scale: pulse }] }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 16 },
  ring: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  label: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
});
