import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

const GRID = 15;
const CELL = Math.floor((Dimensions.get('window').width - 48) / GRID);
const TICK_MS = 150;

type Pos = { x: number; y: number };
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

function randomFood(snake: Pos[]): Pos {
  let pos: Pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

export function SnakeGame() {
  const [snake, setSnake] = useState<Pos[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<Pos>({ x: 3, y: 3 });
  const [dir, setDir] = useState<Dir>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const dirRef = useRef<Dir>('RIGHT');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    const start = [{ x: 7, y: 7 }];
    setSnake(start);
    setFood(randomFood(start));
    setDir('RIGHT');
    dirRef.current = 'RIGHT';
    setGameOver(false);
    setScore(0);
  }

  const tick = useCallback(() => {
    setSnake(prev => {
      const head = prev[0];
      const d = dirRef.current;
      const next: Pos = {
        x: d === 'LEFT' ? head.x - 1 : d === 'RIGHT' ? head.x + 1 : head.x,
        y: d === 'UP' ? head.y - 1 : d === 'DOWN' ? head.y + 1 : head.y,
      };

      // Wall collision
      if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
        setGameOver(true);
        return prev;
      }

      // Self collision
      if (prev.some(s => s.x === next.x && s.y === next.y)) {
        setGameOver(true);
        return prev;
      }

      const newSnake = [next, ...prev];

      // Eat food
      if (next.x === food.x && next.y === food.y) {
        setScore(s => {
          const ns = s + 1;
          setHighScore(h => Math.max(h, ns));
          return ns;
        });
        setFood(randomFood(newSnake));
        return newSnake; // Don't pop tail = grow
      }

      newSnake.pop();
      return newSnake;
    });
  }, [food]);

  useEffect(() => {
    if (gameOver) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(tick, TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [gameOver, tick]);

  // Swipe detection
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
      onPanResponderRelease: (_, g) => {
        const { dx, dy } = g;
        const cur = dirRef.current;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0 && cur !== 'LEFT') { dirRef.current = 'RIGHT'; setDir('RIGHT'); }
          else if (dx < 0 && cur !== 'RIGHT') { dirRef.current = 'LEFT'; setDir('LEFT'); }
        } else {
          if (dy > 0 && cur !== 'UP') { dirRef.current = 'DOWN'; setDir('DOWN'); }
          else if (dy < 0 && cur !== 'DOWN') { dirRef.current = 'UP'; setDir('UP'); }
        }
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.score}>Score: {score}</Text>
        <Text style={styles.highScore}>Best: {highScore}</Text>
      </View>

      <View style={[styles.board, { width: GRID * CELL, height: GRID * CELL }]} {...panResponder.panHandlers}>
        {/* Food */}
        <View style={[styles.food, { left: food.x * CELL, top: food.y * CELL, width: CELL - 2, height: CELL - 2 }]} />
        {/* Snake */}
        {snake.map((s, i) => (
          <View
            key={i}
            style={[
              styles.snakeCell,
              {
                left: s.x * CELL,
                top: s.y * CELL,
                width: CELL - 2,
                height: CELL - 2,
                opacity: i === 0 ? 1 : 0.7 - (i / snake.length) * 0.4,
              },
            ]}
          />
        ))}

        {gameOver && (
          <Pressable style={styles.overlay} onPress={reset}>
            <Text style={styles.gameOverText}>Game Over</Text>
            <Text style={styles.finalScore}>Score: {score}</Text>
            <Text style={styles.tapRestart}>Tap to restart</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.hint}>Swipe to change direction</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  score: { color: '#00d4ff', fontSize: 16, fontWeight: '600' },
  highScore: { color: '#556', fontSize: 16 },
  board: {
    backgroundColor: '#0a1020',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a3055',
    position: 'relative',
    overflow: 'hidden',
  },
  food: {
    position: 'absolute',
    backgroundColor: '#ff4444',
    borderRadius: 3,
  },
  snakeCell: {
    position: 'absolute',
    backgroundColor: '#00d4ff',
    borderRadius: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 13, 26, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverText: { color: '#ff4444', fontSize: 24, fontWeight: 'bold' },
  finalScore: { color: '#aac', fontSize: 16, marginTop: 8 },
  tapRestart: { color: '#445', fontSize: 12, marginTop: 12 },
  hint: { color: '#334', fontSize: 11, marginTop: 12 },
});
