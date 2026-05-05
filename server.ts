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

    socket.on('createRoom', ({ roomId, roomName, name, avatar, maxPlayers }) => {
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
        avatar: avatar || `1`,
        hand: [],
        isTurn: false,
        score: 0,
        isOut: false,
        order: 0
      });

      io.to(roomId).emit('gameState', room);
    });

    socket.on('joinRoom', ({ roomId, name, avatar }) => {
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
          avatar: avatar || `1`,
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
      
      // Auto-leave room on disconnect
      for (const [roomId, room] of rooms.entries()) {
        const pIndex = room.players.findIndex(p => p.id === socket.id);
        if (pIndex !== -1) {
          handlePlayerLeave(roomId, socket.id);
        }
      }
    });

    socket.on('leaveRoom', ({ roomId }) => {
      handlePlayerLeave(roomId, socket.id);
      socket.leave(roomId);
      socket.emit('clearState');
    });

    socket.on('chatMessage', ({ roomId, message }) => {
      // Broadcast chat message to all other players in the room
      socket.to(roomId).emit('chatMessage', message);
    });

    socket.on('startGame', (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id || (room.status !== 'lobby' && room.status !== 'finished')) return;
      if (room.players.length < 2) return;

      startGameLogic(roomId);
    });

    socket.on('playCard', ({ roomId, card }: { roomId: string, card: Card }) => {
      processPlayCard(roomId, socket.id, card, socket);
    });

    socket.on('startAIGame', ({ name, avatar }) => {
      const roomId = randomInt(100000, 999999).toString();
      const room: GameState = {
        roomId,
        hostId: socket.id,
        maxPlayers: 4,
        players: [],
        status: 'lobby',
        tableCards: [],
        leadSuit: null,
        currentTurnIndex: 0,
        roundWinnerId: null,
        donkeyId: null
      };

      room.players.push({
        id: socket.id,
        name: name || `Player`,
        avatar: avatar || `🦊`,
        hand: [],
        isTurn: false,
        score: 0,
        isOut: false,
        order: 0
      });

      // Add 3 AI bots
      const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma'];
      const botAvatars = ['🤖', '👽', '👾'];
      for (let i = 0; i < 3; i++) {
        room.players.push({
          id: `bot_${i}_${roomId}`,
          name: botNames[i],
          avatar: botAvatars[i],
          isBot: true,
          hand: [],
          isTurn: false,
          score: 0,
          isOut: false,
          order: i + 1
        });
      }

      rooms.set(roomId, room);
      socket.join(roomId);
      
      // Auto start game
      startGameLogic(roomId);
    });
  });

  function handlePlayerLeave(roomId: string, socketId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.players = room.players.filter(p => p.id !== socketId);
    
    if (room.players.length === 0 || room.players.filter(p => !p.isBot).length === 0) {
      rooms.delete(roomId);
      return;
    }

    if (room.hostId === socketId) {
      room.hostId = room.players.find(p => !p.isBot)?.id || room.players[0].id;
    }

    if (room.status === 'playing') {
      // Check if game should end
      const stillPlaying = room.players.filter(p => !p.isOut);
      if (stillPlaying.length <= 1) {
        room.status = 'finished';
        room.donkeyId = stillPlaying.length === 1 ? stillPlaying[0].id : null;
        room.players.forEach(p => {
          p.score = p.hand.reduce((total, card) => total + rankPoints[card.rank], 0);
        });
      } else {
        // Clean up table cards left by the disconnected player (discard pile)
        room.tableCards = room.tableCards.filter(tc => room.players.some(p => p.id === tc.playerId));

        if (room.tableCards.length === 0) {
           room.leadSuit = null;
        }

        // Find if someone has played a cut card or trick is finished
        const activePlayers = room.players.filter(p => (!p.isOut && p.hand.length > 0) || room.tableCards.some(t => t.playerId === p.id));
        const allPlayed = room.tableCards.length >= activePlayers.length;
        const isCut = room.leadSuit !== null && room.tableCards.some(t => t.card.suit !== room.leadSuit);

        // If turn was on the left player, give it to the next valid player
        if (room.players.findIndex(p => p.isTurn) === -1 || room.currentTurnIndex >= room.players.length) {
          room.currentTurnIndex = room.currentTurnIndex % room.players.length;
          while (room.players[room.currentTurnIndex] && room.players[room.currentTurnIndex].isOut) {
             room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
          }
          room.players.forEach(p => p.isTurn = false);
          if (room.players[room.currentTurnIndex]) {
             room.players[room.currentTurnIndex].isTurn = true;
          }
        }
        
        if (room.tableCards.length > 0 && (allPlayed || isCut) && !room.isEvaluating) {
           evaluateTrick(roomId, isCut);
        }
      }
    }

    io.to(roomId).emit('gameState', room);
    checkBotTurn(roomId);
  }

  function startGameLogic(roomId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Clear hands first
    room.players.forEach(p => p.hand = []);

    const deck = createDeck();
    shuffle(deck);

    let p = 0;
    while (deck.length > 0) {
      room.players[p].hand.push(deck.pop()!);
      p = (p + 1) % room.players.length;
    }

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
    room.isEvaluating = false;
    room.nextPlacement = 1;
    
    room.players.forEach((player, idx) => {
      player.isTurn = (idx === startingPlayer);
      player.score = 0;
      player.isOut = false;
      player.placement = undefined;
      player.hand.sort((a, b) => {
        if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit);
        return rankValues[b.rank] - rankValues[a.rank];
      });
    });

    io.to(roomId).emit('gameState', room);
    checkBotTurn(roomId);
  }

  function processPlayCard(roomId: string, playerId: string, card: Card, socket?: any) {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing' || room.isEvaluating) return;

    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1 || room.currentTurnIndex !== playerIdx) return;
    
    const player = room.players[playerIdx];

    // Validation
    const hasSuit = player.hand.some(c => c.suit === room.leadSuit);
    if (room.leadSuit && hasSuit && card.suit !== room.leadSuit) {
      if (socket) socket.emit('error', 'Must follow the lead suit!');
      return;
    }

    // Remove card from hand
    const cardIdx = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    if (cardIdx === -1) return;
    player.hand.splice(cardIdx, 1);

    // Add to table
    room.tableCards.push({ playerId, card });

    if (room.tableCards.length === 1) {
      room.leadSuit = card.suit;
    }

    player.isTurn = false;

    // Check if everyone active has played or if someone cuts
    const isCut = room.leadSuit && card.suit !== room.leadSuit;
    
    if (isCut) {
      if (!room.knownVoids) room.knownVoids = {};
      if (!room.knownVoids[playerId]) room.knownVoids[playerId] = [];
      if (!room.knownVoids[playerId].includes(room.leadSuit!)) {
        room.knownVoids[playerId].push(room.leadSuit!);
      }
    }

    const activePlayers = room.players.filter(p => (!p.isOut && p.hand.length > 0) || room.tableCards.some(t => t.playerId === p.id));
    
    if (room.tableCards.length === activePlayers.length || isCut) {
      evaluateTrick(roomId, isCut);
    } else {
      let nT = (playerIdx + 1) % room.players.length;
      while (room.players[nT].isOut) {
        nT = (nT + 1) % room.players.length;
      }
      room.currentTurnIndex = nT;
      room.players[nT].isTurn = true;
      io.to(roomId).emit('gameState', room);
      checkBotTurn(roomId);
    }
  }

  function evaluateTrick(roomId: string, isCut: boolean) {
    const room = rooms.get(roomId);
    if (!room) return;

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
    
    room.isEvaluating = true;

    // Broadcast the result before clearing the table
    io.to(roomId).emit('gameState', room);

    setTimeout(() => {
      room.isEvaluating = false;
      
      if (winnerPlayer) {
         if (cutCardPlayed) {
           for (const tCard of room.tableCards) {
             winnerPlayer.hand.push(tCard.card);
           }
           winnerPlayer.hand.sort((a, b) => {
             if (a.suit !== b.suit) return suits.indexOf(a.suit) - suits.indexOf(b.suit);
             return rankValues[b.rank] - rankValues[a.rank];
           });
           winnerPlayer.isOut = false;
           
           // Clear their known voids since they just picked up unpredictable cards
           if (room.knownVoids && room.knownVoids[winnerPlayer.id]) {
              room.knownVoids[winnerPlayer.id] = [];
           }
         }
      }

      // Clear table and set next turn
      room.tableCards = [];
      room.leadSuit = null;
      room.roundWinnerId = null;
      
      // Update who is out
      room.players.forEach(p => {
         if (p.hand.length === 0 && !p.isOut) {
           p.isOut = true;
           p.placement = room.nextPlacement || 1;
           room.nextPlacement = (room.nextPlacement || 1) + 1;
         }
      });

      const stillPlaying = room.players.filter(p => !p.isOut);
      
      if (stillPlaying.length <= 1) {
        room.status = 'finished';
        room.donkeyId = stillPlaying.length === 1 ? stillPlaying[0].id : winningTableCard.playerId;
        
        const donkeyPlayer = room.players.find(p => p.id === room.donkeyId);
        if (donkeyPlayer && !donkeyPlayer.placement) {
          donkeyPlayer.placement = room.nextPlacement || 1;
          room.nextPlacement = (room.nextPlacement || 1) + 1;
        }
        
        room.players.forEach(p => {
          p.score = p.hand.reduce((total, card) => total + rankPoints[card.rank], 0);
        });

        io.to(roomId).emit('gameState', room);
        return;
      }

      const winnerIdx = room.players.findIndex(p => p.id === winningTableCard.playerId);
      let nT = winnerIdx !== -1 ? winnerIdx : room.currentTurnIndex % room.players.length;
      if (room.players[nT] && room.players[nT].isOut) {
         while (room.players[nT] && room.players[nT].isOut) {
           nT = (nT + 1) % room.players.length;
         }
      }
      
      room.currentTurnIndex = nT;
      if (room.players[nT]) {
        room.players[nT].isTurn = true;
      }
      
      io.to(roomId).emit('gameState', room);
      checkBotTurn(roomId);
    }, 1500);
  }

  function checkBotTurn(roomId: string) {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing' || room.isEvaluating) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer.isBot) return;

    setTimeout(() => {
      const liveRoom = rooms.get(roomId);
      if (!liveRoom || liveRoom.status !== 'playing' || liveRoom.isEvaluating) return;
      if (liveRoom.currentTurnIndex === undefined) return;
      if (liveRoom.players[liveRoom.currentTurnIndex].id !== currentPlayer.id) return;

      const card = chooseBotCard(liveRoom, currentPlayer);
      if (card) {
        processPlayCard(roomId, currentPlayer.id, card);
      }
    }, 1500);
  }

  function chooseBotCard(room: GameState, bot: Player): Card | null {
    if (bot.hand.length === 0) return null;
    
    const hand = [...bot.hand];
    hand.sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);

    if (room.leadSuit) {
      const matching = hand.filter(c => c.suit === room.leadSuit);
      if (matching.length > 0) {
        const activePlayers = room.players.filter(p => (!p.isOut && p.hand.length > 0) || room.tableCards.some(t => t.playerId === p.id));
        const isLastPlayer = room.tableCards.length === activePlayers.length - 1;
        const hasCutCard = room.tableCards.some(tc => tc.card.suit !== room.leadSuit);

        if (isLastPlayer && !hasCutCard) {
          // No one left to strike in this trick and no one has cut! We can safely play our highest matching card.
          return matching[0];
        }

        // Evaluate the highest matching card currently on the table
        const tableMatching = room.tableCards.filter(tc => tc.card.suit === room.leadSuit);
        const currentHighestTableRank = tableMatching.length > 0 
           ? Math.max(...tableMatching.map(tc => rankValues[tc.card.rank]))
           : -1;

        // Find safe cards (those lower than the current highest on the table)
        const safeCards = matching.filter(c => rankValues[c.rank] < currentHighestTableRank);

        if (safeCards.length > 0) {
          // Play the highest safe card to dump it without taking the trick lead
          return safeCards[0];
        } else {
          // We must take the trick lead for now. 
          // If someone has already cut, we REALLY don't want to be the highest. But we have no choice here.
          // Play the lowest matching card to minimize value/risk and hopefully someone else plays higher later.
          return matching[matching.length - 1];
        }
      }
      
      // Strike: No matching suit. 
      // Play highest card from our RISKIEST suit if possible, otherwise highest overall.
      const activeOpponents = room.players.filter(p => !p.isOut && p.id !== bot.id && p.hand.length > 0);
      const suitRisks = new Map<Suit, number>();
      for (const c of hand) {
         if (!suitRisks.has(c.suit)) {
             const voidCount = activeOpponents.filter(p => room.knownVoids?.[p.id]?.includes(c.suit)).length;
             suitRisks.set(c.suit, voidCount);
         }
      }
      
      const strikeCandidates = [...hand].sort((a, b) => {
         const riskA = suitRisks.get(a.suit) || 0;
         const riskB = suitRisks.get(b.suit) || 0;
         if (riskA !== riskB) return riskB - riskA; // prioritize high risk suits
         return rankValues[b.rank] - rankValues[a.rank]; // then high cards
      });
      return strikeCandidates[0];
    } else {
      // Lead: We want to pick a suit that no one is known to be void in.
      const suitsWeHave = Array.from(new Set(hand.map(c => c.suit)));
      const activeOpponents = room.players.filter(p => !p.isOut && p.id !== bot.id && p.hand.length > 0);
      
      const suitRisks = suitsWeHave.map(suit => {
         const voidCount = activeOpponents.filter(p => room.knownVoids?.[p.id]?.includes(suit as Suit)).length;
         return { suit, voidCount };
      });

      const safeSuits = suitRisks.filter(s => s.voidCount === 0).map(s => s.suit);

      if (safeSuits.length > 0) {
        // Lead with highest card of our safe suits
        const candidates = hand.filter(c => safeSuits.includes(c.suit));
        return candidates[0] || hand[0];
      } else {
        // All suits are risky. Pick the one that is void by the fewest people.
        suitRisks.sort((a, b) => a.voidCount - b.voidCount);
        const minVoids = suitRisks[0].voidCount;
        const leastRiskySuits = suitRisks.filter(s => s.voidCount === minVoids).map(s => s.suit);
        
        // Among the least risky suits, choose one randomly to avoid deterministic loops, 
        // and play its lowest card to force others to beat it if they can.
        const bestSuit = leastRiskySuits[Math.floor(Math.random() * leastRiskySuits.length)];
        const candidates = hand.filter(c => c.suit === bestSuit);
        
        return candidates[candidates.length - 1]; // return lowest card of this suit
      }
    }
  }

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
