import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState } from './shared/types';
import { Lobby } from './components/Lobby';
import { GameUI } from './components/GameUI';
import { RotateCw } from 'lucide-react';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Determine WebSocket URL based on app hosting environment
    // Use current origin, but port 3000 where applicable
    // Usually standard `io()` defaults to current origin which is correct.
    const newSocket = io({
      // We will leave defaults, socket.io will figure out the current hostname/port.
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('clearState', () => {
      setGameState(null);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  if (!connected) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono">
        <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 rounded-full border-t-2 border-orange-500 animate-spin"></div>
            <p className="tracking-widest uppercase text-xs text-white/50">Establishing Secure Connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#000000] overflow-hidden text-slate-100 font-sans">
      <div className="w-full h-full flex flex-col relative">
        {!gameState || gameState.status === 'lobby' ? (
          <div className="h-full flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] w-full">
              <Lobby socket={socket} gameState={gameState} />
          </div>
        ) : (
          <div className="w-full h-full">
              <GameUI socket={socket} gameState={gameState} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
