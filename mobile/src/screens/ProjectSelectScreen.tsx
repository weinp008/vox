import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { startSession } from '../api';
import { useSession } from '../context/SessionContext';

interface Props {
  onSessionStarted: () => void;
}

export function ProjectSelectScreen({ onSessionStarted }: Props) {
  const { setSession } = useSession();
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStart(projectPath: string) {
    const trimmed = projectPath.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await startSession(trimmed);
      setSession(res.session_id, res.project_name);
      onSessionStarted();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not start session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>SONAR</Text>
      <Text style={styles.subtitle}>Navigate code by voice</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Project folder name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. my-app"
          placeholderTextColor="#445"
          value={path}
          onChangeText={setPath}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => handleStart(path)}
        />
        <TouchableOpacity
          style={[styles.startBtn, !path.trim() && styles.startBtnDisabled]}
          onPress={() => handleStart(path)}
          disabled={loading || !path.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.startBtnText}>Start Session</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060d1a', justifyContent: 'center', padding: 24 },
  title: { color: '#00d4ff', fontSize: 36, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 },
  subtitle: { color: '#556', textAlign: 'center', marginBottom: 40, marginTop: 8, fontSize: 14 },
  card: {
    backgroundColor: '#0e1628',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1a2744',
  },
  cardLabel: { color: '#556', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  input: {
    backgroundColor: '#060d1a',
    borderWidth: 1,
    borderColor: '#1a2744',
    borderRadius: 8,
    color: '#eef',
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  startBtn: { backgroundColor: '#00d4ff', borderRadius: 8, padding: 14, alignItems: 'center' },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
});
