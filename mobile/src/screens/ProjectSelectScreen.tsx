import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { startSession, listSessions, listProjects, resumeSession, deleteSession, starSession, checkHealth, BASE_URL, SessionSummary } from '../api';
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

function SwipeableSessionItem({
  item,
  onResume,
  onDelete,
  onStar,
  disabled,
}: {
  item: SessionSummary;
  onResume: () => void;
  onDelete: () => void;
  onStar: () => void;
  disabled: boolean;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [revealed, setRevealed] = useState(false);
  const DELETE_WIDTH = 80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        // Only allow leftward swipe
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -DELETE_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -DELETE_WIDTH / 2) {
          Animated.spring(translateX, { toValue: -DELETE_WIDTH, useNativeDriver: true }).start();
          setRevealed(true);
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          setRevealed(false);
        }
      },
    }),
  ).current;

  function handleDelete() {
    Animated.timing(translateX, { toValue: -300, duration: 200, useNativeDriver: true }).start(onDelete);
  }

  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={styles.sessionItem}
          onPress={() => { if (revealed) { Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); setRevealed(false); } else { onResume(); } }}
          disabled={disabled}
        >
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionName}>
              {item.project_name}{item.branch ? ` · ${item.branch}` : ''}
            </Text>
            <View style={styles.sessionMeta}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onStar(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={item.starred ? styles.starOn : styles.starOff}>★</Text>
              </TouchableOpacity>
              <Text style={styles.sessionTime}>{timeAgo(item.updated_at)}</Text>
            </View>
          </View>
          <Text style={styles.sessionPreview} numberOfLines={1}>
            {item.last_message || `${item.message_count} messages`}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function ProjectSelectScreen({ onSessionStarted }: Props) {
  const { setSession, restoreConversation } = useSession();
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(setBackendReachable);
    loadSessions();
    listProjects().then(setProjects);
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
      setSession(res.session_id, res.project_name, res.branch);
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
      setSession(res.session_id, res.project_name, res.branch);
      restoreConversation(res.conversation);
      onSessionStarted();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not resume session');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
    } catch {
      Alert.alert('Error', 'Could not delete session');
    }
  }

  async function handleStar(sessionId: string) {
    try {
      const { starred } = await starSession(sessionId);
      setSessions(prev => {
        const updated = prev.map(s => s.session_id === sessionId ? { ...s, starred } : s);
        return [...updated].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || b.updated_at - a.updated_at);
      });
    } catch {
      // Silently fail
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>SONAR</Text>
        <Text style={styles.subtitle}>Navigate code by voice</Text>

        {backendReachable === false && (
          <TouchableOpacity
            style={styles.healthBanner}
            onPress={() => checkHealth().then(setBackendReachable)}
          >
            <Text style={styles.healthBannerText}>Backend not reachable</Text>
            <Text style={styles.healthBannerUrl}>{BASE_URL}</Text>
            <Text style={styles.healthBannerHint}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        {/* Previous sessions */}
        {sessions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Resume session</Text>
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.session_id}
              style={styles.sessionList}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <SwipeableSessionItem
                  item={item}
                  onResume={() => handleResume(item.session_id)}
                  onDelete={() => handleDelete(item.session_id)}
                  onStar={() => handleStar(item.session_id)}
                  disabled={loading}
                />
              )}
            />
          </View>
        )}

        {loadingSessions && sessions.length === 0 && (
          <ActivityIndicator color="#00d4ff" style={{ marginBottom: 16 }} />
        )}

        {/* Available projects */}
        {projects.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Start new session</Text>
            {projects.map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.projectItem}
                onPress={() => handleNewSession(p)}
                disabled={loading}
              >
                <Text style={styles.projectIcon}>📁</Text>
                <Text style={styles.projectName}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Manual entry fallback */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{projects.length > 0 ? 'Or enter path manually' : 'New session'}</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060d1a' },
  scroll: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  title: { color: '#00d4ff', fontSize: 36, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4 },
  subtitle: { color: '#556', textAlign: 'center', marginBottom: 32, marginTop: 8, fontSize: 14 },
  healthBanner: {
    backgroundColor: '#331a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#662222',
    alignItems: 'center',
  },
  healthBannerText: { color: '#ff6666', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  healthBannerUrl: { color: '#996666', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 6 },
  healthBannerHint: { color: '#884444', fontSize: 11 },
  card: {
    backgroundColor: '#0e1628',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1a2744',
  },
  cardLabel: { color: '#556', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  sessionList: { maxHeight: 220 },
  swipeContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  deleteBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#cc2233',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sessionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0a1528',
    borderRadius: 8,
  },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sessionName: { color: '#aac', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  starOn: { color: '#ffcc00', fontSize: 16 },
  starOff: { color: '#334', fontSize: 16 },
  sessionTime: { color: '#445', fontSize: 11 },
  sessionPreview: { color: '#556', fontSize: 13 },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#0a1528',
    borderRadius: 8,
    marginBottom: 8,
  },
  projectIcon: { fontSize: 16 },
  projectName: { color: '#aac', fontSize: 15, fontWeight: '500' },
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
