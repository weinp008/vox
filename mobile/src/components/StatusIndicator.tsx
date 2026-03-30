import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { UIState } from '../types';

const STATE_CONFIG: Record<UIState, { color: string; label: string }> = {
  idle: { color: '#334466', label: 'Ready' },
  recording: { color: '#ff4444', label: 'Recording' },
  transcribing: { color: '#ff8800', label: 'Transcribing' },
  processing: { color: '#ffaa00', label: 'Claude is working' },
  listening: { color: '#00d4ff', label: 'Listening' },
};

export function StatusIndicator({ uiState, statusDetail }: { uiState: UIState; statusDetail?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const { color, label } = STATE_CONFIG[uiState];
  const shouldPulse = uiState !== 'idle';
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer for non-idle states
  useEffect(() => {
    if (uiState !== 'idle') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [uiState]);

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

  const showTimer = uiState === 'transcribing' || uiState === 'processing';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, { borderColor: color, transform: [{ scale: pulse }] }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {showTimer && (
        <Text style={[styles.timer, { color }]}>{elapsed}s</Text>
      )}
      {statusDetail && uiState !== 'idle' && (
        <Text style={styles.detail}>{statusDetail}</Text>
      )}
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
  timer: { fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] },
  detail: { color: '#556', fontSize: 10, marginTop: 2 },
});
