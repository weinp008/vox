import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PromptResponse } from '../types';

export function TranscriptDisplay({ response }: { response: PromptResponse | null }) {
  if (!response) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Hold the button and speak a voice command</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.bubble}>
        <Text style={styles.label}>You said</Text>
        <Text style={styles.transcript}>{response.transcript}</Text>
      </View>
      <View style={[styles.bubble, styles.responseBubble]}>
        <Text style={styles.label}>Sonar</Text>
        <Text style={styles.responseText}>{response.response_text}</Text>
      </View>
      {response.pending_diff && (
        <View style={styles.diffBadge}>
          <Text style={styles.diffText}>Pending diff ready — say "send" to apply</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  content: { padding: 16, gap: 12 },
  hint: { color: '#556', textAlign: 'center', marginTop: 40, fontSize: 15 },
  bubble: {
    backgroundColor: '#0e1628',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#334466',
  },
  responseBubble: { borderLeftColor: '#00d4ff' },
  label: { color: '#556', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  transcript: { color: '#ccd', fontSize: 15 },
  responseText: { color: '#eef', fontSize: 15, lineHeight: 22 },
  diffBadge: {
    backgroundColor: '#1a2f1a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2d6a2d',
  },
  diffText: { color: '#5d5', fontSize: 13, textAlign: 'center' },
});
