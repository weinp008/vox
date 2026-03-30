import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { startSession, listSessions, resumeSession, SessionSummary } from '../api';
import { useSession } from '../context/SessionContext';

interface Props {
  onSessionStarted: () => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ProjectSelectScreen({ onSessionStarted }: Props) {
  const { setSession, restoreConversation } = useSession();
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const list = await listSessions();
      setSessions(list);
    } catch {
      // Silently fail — just show empty
    }
    setLoadingSessions(false);
  }

  async function handleNewSession(projectPath: string) {
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

  async function handleResume(sessionId: string) {
    setLoading(true);
    try {
      const res = await resumeSession(sessionId);
      setSession(res.session_id, res.project_name);
      restoreConversation(res.conversation);
      onSessionStarted();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not resume session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>SONAR</Text>
      <Text style={styles.subtitle}>Navigate code by voice</Text>

      {/* Previous sessions */}
      {sessions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Resume session</Text>
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.session_id}
            style={styles.sessionList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.sessionItem}
                onPress={() => handleResume(item.session_id)}
                disabled={loading}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionName}>{item.project_name}</Text>
                  <Text style={styles.sessionTime}>{timeAgo(item.updated_at)}</Text>
                </View>
                <Text style={styles.sessionPreview} numberOfLines={1}>
                  {item.last_message || `${item.message_count} messages`}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {loadingSessions && sessions.length === 0 && (
        <ActivityIndicator color="#00d4ff" style={{ marginBottom: 16 }} />
      )}

      {/* New session */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>New session</Text>
        <TextInput
          style={styles.input}
          placeholder="project folder name"
          placeholderTextColor="#445"
          value={path}
          onChangeText={setPath}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => handleNewSession(path)}
        />
        <TouchableOpacity
          style={[styles.startBtn, !path.trim() && styles.startBtnDisabled]}
          onPress={() => handleNewSession(path)}
          disabled={loading || !path.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.startBtnText}>Start</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060d1a', justifyContent: 'center', padding: 24 },
  title: { color: '#00d4ff', fontSize: 36, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 },
  subtitle: { color: '#556', textAlign: 'center', marginBottom: 32, marginTop: 8, fontSize: 14 },
  card: {
    backgroundColor: '#0e1628',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1a2744',
  },
  cardLabel: { color: '#556', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  sessionList: { maxHeight: 200 },
  sessionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0a1528',
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sessionName: { color: '#aac', fontSize: 15, fontWeight: '600' },
  sessionTime: { color: '#445', fontSize: 11 },
  sessionPreview: { color: '#556', fontSize: 13 },
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
