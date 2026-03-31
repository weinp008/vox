import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Cell = 'X' | 'O' | null;
type Board = Cell[];

const WINS = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],          // diags
];

function checkWin(board: Board): Cell {
  for (const [a,b,c] of WINS) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return null;
}

function aiMove(board: Board): number {
  // Simple AI: win > block > center > random
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
  if (empty.length === 0) return -1;

  // Try to win
  for (const i of empty) {
    const test = [...board]; test[i] = 'O';
    if (checkWin(test) === 'O') return i;
  }
  // Block player
  for (const i of empty) {
    const test = [...board]; test[i] = 'X';
    if (checkWin(test) === 'X') return i;
  }
  // Center
  if (board[4] === null) return 4;
  // Random
  return empty[Math.floor(Math.random() * empty.length)];
}

export function MiniGame() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('Your turn — tap a cell');
  const [score, setScore] = useState({ you: 0, ai: 0 });

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setGameOver(false);
    setMessage('Your turn');
  }, []);

  function handleTap(i: number) {
    if (board[i] || gameOver) return;

    const next = [...board];
    next[i] = 'X';

    const playerWin = checkWin(next);
    if (playerWin) {
      setBoard(next);
      setMessage('You win!');
      setScore(s => ({ ...s, you: s.you + 1 }));
      setGameOver(true);
      return;
    }

    if (next.every(c => c !== null)) {
      setBoard(next);
      setMessage('Draw!');
      setGameOver(true);
      return;
    }

    // AI turn
    const ai = aiMove(next);
    if (ai >= 0) next[ai] = 'O';

    const aiWin = checkWin(next);
    if (aiWin) {
      setBoard(next);
      setMessage('AI wins!');
      setScore(s => ({ ...s, ai: s.ai + 1 }));
      setGameOver(true);
      return;
    }

    if (next.every(c => c !== null)) {
      setBoard(next);
      setMessage('Draw!');
      setGameOver(true);
      return;
    }

    setBoard(next);
    setMessage('Your turn');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>While you wait...</Text>
      <Text style={styles.score}>You {score.you} — {score.ai} AI</Text>
      <View style={styles.board}>
        {board.map((cell, i) => (
          <Pressable
            key={i}
            style={[styles.cell, i % 3 < 2 && styles.cellRight, i < 6 && styles.cellBottom]}
            onPress={() => handleTap(i)}
          >
            <Text style={[styles.cellText, cell === 'X' ? styles.cellX : styles.cellO]}>
              {cell ?? ''}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.message}>{message}</Text>
      {gameOver && (
        <Pressable onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>Play again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 12 },
  title: { color: '#445', fontSize: 11, marginBottom: 6 },
  score: { color: '#667', fontSize: 12, marginBottom: 10 },
  board: {
    width: 150,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellRight: { borderRightWidth: 1, borderRightColor: '#1a3055' },
  cellBottom: { borderBottomWidth: 1, borderBottomColor: '#1a3055' },
  cellText: { fontSize: 24, fontWeight: 'bold' },
  cellX: { color: '#00d4ff' },
  cellO: { color: '#ff6644' },
  message: { color: '#556', fontSize: 11, marginTop: 8 },
  resetBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#1a2744', borderRadius: 8 },
  resetText: { color: '#00d4ff', fontSize: 12 },
});
