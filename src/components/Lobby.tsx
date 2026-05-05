import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';
import { Copy, Check } from 'lucide-react';
import { Player, GameState } from '../shared/types';

interface LobbyProps {
  socket: Socket | null;
  gameState: GameState | null;
}

export function Lobby({ socket, gameState }: LobbyProps) {
  const [tab, setTab] = useState<'create' | 'join'>('join');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [maxPlayersInput, setMaxPlayersInput] = useState('4');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [avatar, setAvatar] = useState('🦊');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomInput(room.toUpperCase().trim());
      setTab('join');
      // If we have a room name in the state, we could show it, but we don't yet.
    }
  }, [window.location.search]);

  useEffect(() => {
    if (!socket) return;
    const handleError = (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 3000);
    };
    socket.on('error', handleError);
    return () => { socket.off('error', handleError); };
  }, [socket]);

  const handleCreate = () => {
    if (!roomNameInput || !nameInput || !socket) return;
    const generatedRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    socket.emit('createRoom', { roomId: generatedRoomCode, roomName: roomNameInput, name: nameInput, maxPlayers: maxPlayersInput, avatar });
  };

  const handleJoin = () => {
    if (!roomInput || !nameInput || !socket) return;
    socket.emit('joinRoom', { roomId: roomInput, name: nameInput, avatar });
  };

  const handleStart = async () => {
    if (!socket || !gameState) return;
    
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
        await (window.screen.orientation as any).lock('landscape');
      }
    } catch (err) {
      console.warn('Could not lock orientation or enter fullscreen:', err);
    }
    
    socket.emit('startGame', gameState.roomId);
  };

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[#0d1615] rounded-3xl border border-white/5 shadow-2xl w-full max-w-md mx-auto relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl"></div>
        
        <h1 className="text-5xl font-serif text-white tracking-widest text-center shadow-black/50 z-10 mb-2">
          കഴുതകളി
        </h1>
        <p className="text-white/60 tracking-widest text-xs uppercase z-10 mb-8">Real-time Card Game</p>
        
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-xl text-center text-xs tracking-widest uppercase mb-4 z-10"
          >
            {errorMsg}
          </motion.div>
        )}

        {/* Custom Tabs */}
        <div className="flex w-full bg-black/40 rounded-xl p-1 mb-6 z-10 border border-white/5">
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${tab === 'join' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
          >
            Join
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${tab === 'create' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}
          >
            Create
          </button>
        </div>

        <div className="w-full mb-6">
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2 text-center">Choose Avatar</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {['🦊', '🐰', '🐱', '🐶', '🐻', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐷'].map(emoji => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className={`w-10 h-10 rounded-full text-xl flex items-center justify-center transition-all ${avatar === emoji ? 'bg-emerald-500 scale-110 shadow-lg shadow-emerald-500/50' : 'bg-white/10 hover:bg-white/20 hover:scale-105'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full relative z-10 overflow-hidden min-h-[220px]">
          <AnimatePresence mode="wait">
            {tab === 'join' ? (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {roomInput && new URLSearchParams(window.location.search).get('room') && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl mb-2">
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest text-center">Joining via invite link</p>
                  </div>
                )}
                <input
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/30 font-medium"
                  placeholder="Your Name"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value.substring(0, 12))}
                />
                <input
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors uppercase placeholder:text-white/30 font-mono tracking-widest"
                  placeholder="Room Code"
                  value={roomInput}
                  onChange={e => setRoomInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                />
                <button
                  onClick={handleJoin}
                  disabled={!roomInput || !nameInput}
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 text-white font-bold tracking-widest text-sm uppercase py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/50 disabled:shadow-none disabled:text-white/20"
                >
                  Join Room
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <input
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/30 font-medium"
                  placeholder="Your Name"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value.substring(0, 12))}
                />
                <input
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/30 font-medium"
                  placeholder="Room Name"
                  value={roomNameInput}
                  onChange={e => setRoomNameInput(e.target.value.substring(0, 20))}
                />
                <select
                  className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
                  value={maxPlayersInput}
                  onChange={e => setMaxPlayersInput(e.target.value)}
                >
                  <option value="2">2 Players</option>
                  <option value="3">3 Players</option>
                  <option value="4">4 Players</option>
                  <option value="5">5 Players</option>
                  <option value="6">6 Players</option>
                </select>
                <button
                  onClick={handleCreate}
                  disabled={!roomNameInput || !nameInput}
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 text-white font-bold tracking-widest text-sm uppercase py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/50 disabled:shadow-none disabled:text-white/30"
                >
                  Create Room
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const isHost = socket?.id === gameState.hostId;

  const copyInviteLink = () => {
    try {
        const searchParams = new URLSearchParams();
        searchParams.set('room', gameState.roomId);
        
        let finalUrlStr = window.location.origin + '/?' + searchParams.toString();

        navigator.clipboard.writeText(finalUrlStr).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            alert("Invite URL: " + finalUrlStr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    } catch (e) {
        console.error('Failed to copy', e);
        const fallback = window.location.origin + '/?room=' + gameState.roomId;
        navigator.clipboard.writeText(fallback);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    const searchParams = new URLSearchParams();
    searchParams.set('room', gameState.roomId);
    let shareUrl = window.location.origin + '/?' + searchParams.toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my കഴുതകളി Room: ${gameState.roomName}`,
          text: `Use code ${gameState.roomId} to join the game!`,
          url: shareUrl,
        });
      } catch (err) {
        copyInviteLink();
      }
    } else {
      copyInviteLink();
    }
  };

  return (
    <div className="flex flex-col items-center p-8 md:p-12 bg-[#0d1615] rounded-3xl border border-white/5 shadow-2xl w-full max-w-md mx-auto relative overflow-hidden backdrop-blur-xl">
      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0d1615]/0 to-transparent"></div>
      
      <div className="z-10 w-full text-center mb-6 relative">
        <h1 className="text-2xl font-serif text-white tracking-widest mb-4">
          {gameState.roomName || 'കഴുതകളി Room'}
        </h1>
        <h2 className="text-white/50 text-xs font-mono uppercase tracking-widest mb-1">Room Code</h2>
        <div className="text-4xl font-mono text-emerald-400 font-bold tracking-widest bg-emerald-400/10 inline-block px-6 py-2 rounded-lg border border-emerald-400/20 mb-4">
          {gameState.roomId}
        </div>
        
        <button 
          onClick={handleNativeShare}
          className="flex items-center justify-center space-x-2 w-full bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 text-white py-3 rounded-lg transition-all active:scale-95 text-sm font-bold uppercase tracking-widest shadow-lg shadow-emerald-900/40"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          <span>{copied ? 'Link Copied!' : 'Invite Friends'}</span>
        </button>
        
        <div className="mt-4 p-4 bg-red-500/10 rounded-xl border border-red-500/30 text-left">
           <p className="text-[11px] text-red-400 font-bold uppercase tracking-widest mb-1 flex items-center">
             <span className="mr-2">âš ï¸</span> Action Required
           </p>
           <p className="text-[10px] text-white/80 leading-relaxed">
             1. Click the <span className="text-white font-bold underline">"Share"</span> button in the top right of <span className="italic">AI Studio</span>.<br/>
             2. Set visibility to <span className="text-emerald-400 font-bold">"Anyone with the link"</span>.<br/>
             3. <span className="text-emerald-400 font-bold">Only then</span> will this link work for your friends. Otherwise, they will see a <span className="text-red-400">404/403 Error</span>.
           </p>
        </div>
      </div>

      <div className="w-full space-y-3 z-10">
        <h3 className="text-white/40 text-xs uppercase tracking-widest border-b border-white/10 pb-2">Players Waiting ({gameState.players.length}/{gameState.maxPlayers})</h3>
        {gameState.players.map((p, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={p.id} 
            className="flex items-center justify-between bg-white/5 px-4 py-3 rounded-lg border border-white/5"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-xl shadow-inner">
                {p.avatar || '🦊'}
              </div>
              <span className="text-white font-medium">{p.name}</span>
            </div>
            {p.id === gameState.hostId && (
              <span className="text-emerald-400 text-xs uppercase tracking-wider font-bold">Host</span>
            )}
          </motion.div>
        ))}
      </div>

      {isHost && (
        <button
          onClick={handleStart}
          disabled={gameState.players.length < 2}
          className="mt-8 z-10 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-white/30 text-white font-bold tracking-wider py-4 rounded-xl transition-all active:scale-95 uppercase shadow-xl shadow-emerald-900/50"
        >
          {gameState.players.length < 2 ? 'Waiting for players...' : 'Deal Cards'}
        </button>
      )}
      {!isHost && (
        <div className="mt-8 z-10 p-4 w-full text-center border-t border-white/10">
          <p className="text-white/50 animate-pulse uppercase tracking-widest text-xs">Waiting for host to begin...</p>
        </div>
      )}
    </div>
  );
}
