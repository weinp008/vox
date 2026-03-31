import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

type Card = { rank: string; suit: string; value: number };

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      const value = i === 0 ? 11 : i >= 10 ? 10 : i + 1;
      deck.push({ rank: RANKS[i], suit, value });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handTotal(hand: Card[]): number {
  let total = hand.reduce((s, c) => s + c.value, 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function CardView({ card, hidden }: { card: Card; hidden?: boolean }) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  if (hidden) {
    return (
      <View style={[styles.card, styles.cardHidden]}>
        <Text style={styles.cardBack}>?</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={[styles.cardRank, isRed && styles.cardRed]}>{card.rank}</Text>
      <Text style={[styles.cardSuit, isRed && styles.cardRed]}>{card.suit}</Text>
    </View>
  );
}

export function CardGame() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [phase, setPhase] = useState<'betting' | 'playing' | 'dealer' | 'done'>('betting');
  const [result, setResult] = useState('');
  const [score, setScore] = useState({ wins: 0, losses: 0 });

  function deal() {
    const d = makeDeck();
    setDeck(d.slice(4));
    setPlayer([d[0], d[2]]);
    setDealer([d[1], d[3]]);
    setPhase('playing');
    setResult('');
  }

  function hit() {
    const newDeck = [...deck];
    const card = newDeck.shift()!;
    setDeck(newDeck);
    const newHand = [...player, card];
    setPlayer(newHand);
    if (handTotal(newHand) > 21) {
      setResult('Bust!');
      setScore(s => ({ ...s, losses: s.losses + 1 }));
      setPhase('done');
    }
  }

  function stand() {
    setPhase('dealer');
  }

  // Dealer plays automatically
  useEffect(() => {
    if (phase !== 'dealer') return;
    const dealerTotal = handTotal(dealer);
    if (dealerTotal < 17 && deck.length > 0) {
      const timer = setTimeout(() => {
        const newDeck = [...deck];
        const card = newDeck.shift()!;
        setDeck(newDeck);
        setDealer(prev => [...prev, card]);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Resolve
      const pTotal = handTotal(player);
      const dTotal = handTotal(dealer);
      if (dTotal > 21) {
        setResult('Dealer busts — you win!');
        setScore(s => ({ ...s, wins: s.wins + 1 }));
      } else if (pTotal > dTotal) {
        setResult('You win!');
        setScore(s => ({ ...s, wins: s.wins + 1 }));
      } else if (pTotal < dTotal) {
        setResult('Dealer wins');
        setScore(s => ({ ...s, losses: s.losses + 1 }));
      } else {
        setResult('Push');
      }
      setPhase('done');
    }
  }, [phase, dealer, deck, player]);

  const playerTotal = handTotal(player);
  const dealerTotal = handTotal(dealer);
  const showDealer = phase === 'dealer' || phase === 'done';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Blackjack</Text>
      <Text style={styles.scoreText}>W {score.wins} — L {score.losses}</Text>

      {/* Dealer hand */}
      <View style={styles.section}>
        <Text style={styles.label}>Dealer {showDealer ? `(${dealerTotal})` : ''}</Text>
        <View style={styles.hand}>
          {dealer.map((c, i) => (
            <CardView key={i} card={c} hidden={i === 1 && !showDealer} />
          ))}
        </View>
      </View>

      {/* Player hand */}
      <View style={styles.section}>
        <Text style={styles.label}>You ({playerTotal})</Text>
        <View style={styles.hand}>
          {player.map((c, i) => (
            <CardView key={i} card={c} />
          ))}
        </View>
      </View>

      {/* Controls */}
      {phase === 'betting' && (
        <Pressable style={styles.btn} onPress={deal}>
          <Text style={styles.btnText}>Deal</Text>
        </Pressable>
      )}

      {phase === 'playing' && (
        <View style={styles.actions}>
          <Pressable style={styles.btn} onPress={hit}>
            <Text style={styles.btnText}>Hit</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnStand]} onPress={stand}>
            <Text style={styles.btnText}>Stand</Text>
          </Pressable>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.resultArea}>
          <Text style={[styles.resultText, result.includes('win') && styles.resultWin, result.includes('Bust') && styles.resultLose]}>
            {result}
          </Text>
          <Pressable style={styles.btn} onPress={deal}>
            <Text style={styles.btnText}>Deal again</Text>
          </Pressable>
        </View>
      )}

      {phase === 'dealer' && (
        <Text style={styles.dealerThinking}>Dealer drawing...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, paddingTop: 20 },
  title: { color: '#eef', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  scoreText: { color: '#556', fontSize: 13, marginBottom: 16 },
  section: { marginBottom: 16, alignItems: 'center' },
  label: { color: '#667', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  hand: { flexDirection: 'row', gap: 8 },
  card: {
    width: 50,
    height: 70,
    backgroundColor: '#f5f5f0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cardHidden: { backgroundColor: '#1a3055' },
  cardBack: { color: '#00d4ff', fontSize: 24, fontWeight: 'bold' },
  cardRank: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  cardSuit: { fontSize: 14, color: '#222', marginTop: -2 },
  cardRed: { color: '#cc2222' },
  actions: { flexDirection: 'row', gap: 16 },
  btn: {
    backgroundColor: '#1a2744',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00d4ff',
  },
  btnStand: { borderColor: '#ffaa00' },
  btnText: { color: '#eef', fontSize: 14, fontWeight: '600' },
  resultArea: { alignItems: 'center', gap: 12 },
  resultText: { color: '#aac', fontSize: 18, fontWeight: '600' },
  resultWin: { color: '#00ff88' },
  resultLose: { color: '#ff4444' },
  dealerThinking: { color: '#ffaa00', fontSize: 13 },
});
