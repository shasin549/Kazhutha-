export type Suit = '♠️' | '♥️' | '♦️' | '♣️';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string; // socket.id
  name: string;
  hand: Card[];
  isTurn: boolean;
  score: number;
  isOut: boolean;
  order: number;
}

export interface TableCard {
  playerId: string;
  card: Card;
}

export interface GameState {
  roomId: string;
  roomName?: string;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  status: 'lobby' | 'playing' | 'finished';
  currentTurnIndex: number;
  tableCards: TableCard[];
  leadSuit: Suit | null;
  roundWinnerId: string | null;
  donkeyId: string | null;
}
