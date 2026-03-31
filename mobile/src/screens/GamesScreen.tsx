import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MiniGame } from '../components/MiniGame';
import { SnakeGame } from '../components/SnakeGame';

type Game = 'menu' | 'tictactoe' | 'snake';

interface Props {
  onBack: () => void;
  statusLine?: string; // Shows Claude's current activity at the top
}

export function GamesScreen({ onBack, statusLine }: Props) {
  const [game, setGame] = useState<Game>('menu');

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar — shows what Claude is doing */}
      {statusLine && (
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText} numberOfLines={1}>{statusLine}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={game === 'menu' ? onBack : () => setGame('menu')}>
          <Text style={styles.backText}>{game === 'menu' ? '← Back to session' : '← Games'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Arcade</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.body}>
        {game === 'menu' && (
          <View style={styles.menu}>
            <TouchableOpacity style={styles.gameCard} onPress={() => setGame('tictactoe')}>
              <Text style={styles.gameIcon}>✕○</Text>
              <Text style={styles.gameName}>Tic-Tac-Toe</Text>
              <Text style={styles.gameDesc}>Classic strategy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gameCard} onPress={() => setGame('snake')}>
              <Text style={styles.gameIcon}>🐍</Text>
              <Text style={styles.gameName}>Snake</Text>
              <Text style={styles.gameDesc}>Swipe to eat</Text>
            </TouchableOpacity>
          </View>
        )}

        {game === 'tictactoe' && <MiniGame />}
        {game === 'snake' && <SnakeGame />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060d1a' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#0e1628',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffaa00',
  },
  statusText: { color: '#ffaa00', fontSize: 11, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1628',
  },
  backText: { color: '#00d4ff', fontSize: 14 },
  title: { color: '#eef', fontWeight: '600', fontSize: 18 },
  body: { flex: 1, padding: 16 },
  menu: { flexDirection: 'row', gap: 16, justifyContent: 'center', paddingTop: 40 },
  gameCard: {
    width: 140,
    backgroundColor: '#0e1628',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a3055',
  },
  gameIcon: { fontSize: 32, marginBottom: 8 },
  gameName: { color: '#eef', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  gameDesc: { color: '#556', fontSize: 12 },
});
