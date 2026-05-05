import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import { randomInt } from 'crypto';
import { GameState, Suit, Rank, Card, Player, TableCard } from './src/shared/types';

// Game State Storage
const rooms = new Map<string, GameState>();

const suits: Suit[] = ['♠️', '♦️', '♣️', '♥️'];
const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(array: any[]) {
  // Shuffle 7 times for thoroughness, similar to riffle shuffling
  for (let s = 0; s < 7; s++) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1); // Cryptographically secure random int between 0 and i
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}


const rankValues: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const rankPoints: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 10
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // API routines
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', ({ roomId, roomName, name, maxPlayers }) => {
      if (rooms.has(roomId)) {
        socket.emit('error', 'Room code already in use!');
        return;
      }
      
      const parsedMaxPlayers = parseInt(maxPlayers) || 4;
      if (parsedMaxPlayers < 2 || parsedMaxPlayers > 6) {
        socket.emit('error', 'Max players must be between 2 and 6.');
        return;
      }

      socket.join(roomId);

      rooms.set(roomId, {
        roomId,
        roomName: roomName || roomId,
        hostId: socket.id,
        maxPlayers: parsedMaxPlayers,
        players: [],
        status: 'lobby',
        currentTurnIndex: 0,
        tableCards: [],
        leadSuit: null,
        roundWinnerId: null,
        donkeyId: null
      });

      const room = rooms.get(roomId)!;
      room.players.push({
        id: socket.id,
        name: name || `Player 1`,
        hand: [],
        isTurn: false,
        score: 0,
        isOut: false,
        order: 0
      });

      io.to(roomId).emit('gameState', room);
    });

    socket.on('joinRoom', ({ roomId, name }) => {
      if (!rooms.has(roomId)) {
        socket.emit('error', 'Room not found!');
        return;
      }
      
      const room = rooms.get(roomId)!;
      if (room.status !== 'lobby') {
        socket.emit('error', 'Game already in progress!');
        return;
      }

      if (!room.players.find(p => p.id === socket.id)) {
        if (room.players.length >= room.maxPlayers) {
          socket.emit('error', 'Room is full!');
          return;
        }
        socket.join(roomId);

        room.players.push({
          id: socket.id,
          name: name || `Player ${room.players.length + 1}`,
          hand: [],
          isTurn: false,
          score: 0,
          isOut: false,
          order: room.players.length
        });
      }

      io.to(roomId).emit('gameState', room);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Optional: handle player leaving room if needed
    });

    socket.on('chatMessage', ({ roomId, message }) => {
      // Broadcast chat message to all other players in the room
      socket.to(roomId).emit('chatMessage', message);
    });

    socket.on('startGame', (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id || (room.status !== 'lobby' && room.status !== 'finished')) return;
      if (room.players.length < 2) return;

      const deck = createDeck();
      shuffle(deck);

      // Distribute equally (some might have 1 more)
      let p = 0;
      while (deck.length > 0) {
        room.players[p].hand.push(deck.pop()!);
        p = (p + 1) % room.players.length;
      }

      // Find Ace of Spades
      let startingPlayer = 0;
      for (let i = 0; i < room.players.length; i++) {
        if (room.players[i].hand.some(c => c.suit === '♠️' && c.rank === 'A')) {
          startingPlayer = i;
          break;
        }
      }

      room.status = 'playing';
      room.currentTurnIndex = startingPlayer;
      room.tableCards = [];
      room.leadSuit = null;
      room.roundWinnerId = null;
      room.donkeyId = null;
      room.players.forEach((player, idx) => {
        player.isTurn = (idx === startingPlayer);
        player.score = 0;
        player.isOut = false;
        // sort hand for convenience
        player.hand.sort((a, b) => {
          if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit);
          return rankValues[b.rank] - rankValues[a.rank];
        });
      });

      io.to(roomId).emit('gameState', room);
    });

    socket.on('playCard', ({ roomId, card }: { roomId: string, card: Card }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const playerIdx = room.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1 || room.currentTurnIndex !== playerIdx) return;
      
      const player = room.players[playerIdx];

      // Validation
      const hasSuit = player.hand.some(c => c.suit === room.leadSuit);
      if (room.leadSuit && hasSuit && card.suit !== room.leadSuit) {
        socket.emit('error', 'Must follow the lead suit!');
        return;
      }

      // Remove card from hand
      const cardIdx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      if (cardIdx === -1) return;
      player.hand.splice(cardIdx, 1);

      // Add to table
      room.tableCards.push({ playerId: socket.id, card });

      if (room.tableCards.length === 1) {
        room.leadSuit = card.suit;
      }

      player.isTurn = false;

      // Check if everyone active has played or if someone cuts
      const isCut = room.leadSuit && card.suit !== room.leadSuit;
      const activePlayers = room.players.filter(p => !p.isOut && p.hand.length > 0 || room.tableCards.some(t => t.playerId === p.id));
      
      if (room.tableCards.length === activePlayers.length || isCut) {
        // Evaluate trick
        let winningTableCard = room.tableCards[0];
        let cutCardPlayed = false;

        for (const tCard of room.tableCards) {
          if (room.leadSuit && tCard.card.suit !== room.leadSuit) {
             cutCardPlayed = true;
          } else if (tCard.card.suit === room.leadSuit) {
            if (rankValues[tCard.card.rank] > rankValues[winningTableCard.card.rank]) {
              winningTableCard = tCard;
            }
          }
        }

        room.roundWinnerId = winningTableCard.playerId;
        const winnerPlayer = room.players.find(p => p.id === winningTableCard.playerId);

        // Broadcast the result before clearing the table
        io.to(roomId).emit('gameState', room);

        setTimeout(() => {
          if (winnerPlayer) {
             if (cutCardPlayed) {
               // The winner picks up all cards played in the trick into their hand
               for (const tCard of room.tableCards) {
                 winnerPlayer.hand.push(tCard.card);
               }
               // Sort hand again
               winnerPlayer.hand.sort((a, b) => {
                 if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit);
                 return rankValues[b.rank] - rankValues[a.rank];
               });
               // Make sure they are not marked as out
               winnerPlayer.isOut = false;
             }
          }

          // Clear table and set next turn
          room.tableCards = [];
          room.leadSuit = null;
          room.roundWinnerId = null;
          
          // Update who is out
          room.players.forEach(p => {
             if (p.hand.length === 0) p.isOut = true;
          });

          const stillPlaying = room.players.filter(p => !p.isOut);
          
          if (stillPlaying.length <= 1) {
            // Game Over
            room.status = 'finished';
            // Determine Donkey: the last one remaining, or if none, the round winner/last player
            room.donkeyId = stillPlaying.length === 1 ? stillPlaying[0].id : winningTableCard.playerId;
            
            // Calculate final scores based on remaining cards
            room.players.forEach(p => {
              p.score = p.hand.reduce((total, card) => total + rankPoints[card.rank], 0);
            });

            io.to(roomId).emit('gameState', room);
            return;
          }

          // Next turn is the winner, or the next available player
          const winnerIdx = room.players.findIndex(p => p.id === winningTableCard.playerId);
          let nT = winnerIdx;
          if (room.players[nT].isOut) {
             // Find next active
             while (room.players[nT].isOut) {
               nT = (nT + 1) % room.players.length;
             }
          }
          
          room.currentTurnIndex = nT;
          room.players[nT].isTurn = true;
          
          io.to(roomId).emit('gameState', room);
        }, 2500);

      } else {
        // Pass turn to next active player
        let nT = (playerIdx + 1) % room.players.length;
        while (room.players[nT].isOut) {
          nT = (nT + 1) % room.players.length;
        }
        room.currentTurnIndex = nT;
        room.players[nT].isTurn = true;
        io.to(roomId).emit('gameState', room);
      }

    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit fallback for dev mode if vite middleware misses it
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.includes('.')) return next();
      
      try {
        const fs = await import('fs');
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
