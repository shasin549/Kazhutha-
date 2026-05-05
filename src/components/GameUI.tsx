import { Socket } from 'socket.io-client';
import { GameState, Card, Player } from '../shared/types';
import { CardComponent } from './CardComponent';
import { ChatBox } from './ChatBox';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

interface GameUIProps {
  socket: Socket | null;
  gameState: GameState;
}

function getPlacementText(placement?: number, isLoser?: boolean) {
  if (isLoser) return 'കഴുത 🐴';
  switch (placement) {
    case 1: return '1st 🥇';
    case 2: return '2nd 🥈';
    case 3: return '3rd 🥉';
    case 4: return '4th';
    case 5: return '5th';
    default: return 'OUT';
  }
}

export function GameUI({ socket, gameState }: GameUIProps) {
  const me = gameState.players.find(p => p.id === socket?.id);
  const myIndex = gameState.players.findIndex(p => p.id === socket?.id);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDealing, setIsDealing] = useState(false);
  const [shakeCardStr, setShakeCardStr] = useState<string | null>(null);

  useEffect(() => {
    if (gameState.status === 'playing') {
      const totalCards = gameState.players.reduce((sum, p) => sum + p.hand.length, 0);
      if (totalCards === 52 && gameState.tableCards.length === 0) {
        setIsDealing(true);
        const timeout = setTimeout(() => {
          setIsDealing(false);
        }, 52 * 0.07 * 1000 + 1000);
        return () => clearTimeout(timeout);
      } else {
        setIsDealing(false);
      }
    }
  }, [gameState.status, gameState.roomId]);

  // Reorder players so "me" is at the bottom.
  const orderedPlayers = [];
  if (myIndex !== -1) {
    for (let i = 0; i < gameState.players.length; i++) {
        // Skip myself for the top/sides depending on count, but keep order
        const p = gameState.players[(myIndex + i) % gameState.players.length];
        orderedPlayers.push(p);
    }
  } else {
      orderedPlayers.push(...gameState.players);
  }

  // Hide error msg after 3 seconds
  useEffect(() => {
    if (!socket) return;
    const handleError = (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 3000);
    };
    socket.on('error', handleError);
    return () => { socket.off('error', handleError); };
  }, [socket]);

  const handlePlayCard = (card: Card) => {
    if (!socket || !me?.isTurn) return;
    
    // Validate move
    if (gameState.leadSuit && card.suit !== gameState.leadSuit && me.hand.some(c => c.suit === gameState.leadSuit)) {
      setShakeCardStr(`${card.suit}-${card.rank}`);
      setTimeout(() => setShakeCardStr(null), 500);
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } catch (e) {}
      return;
    }
    
    try {
      const isStrike = gameState.leadSuit && card.suit !== gameState.leadSuit;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = isStrike ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isStrike ? 200 : 400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isStrike ? 50 : 800, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}

    socket.emit('playCard', { roomId: gameState.roomId, card });
  };

  if (gameState.status === 'finished') {
    const donkey = gameState.players.find(p => p.id === gameState.donkeyId);
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 p-12 text-center text-white">
         <h1 className="text-6xl font-serif text-amber-500 tracking-widest drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">GAME OVER</h1>
         
         <div className="bg-red-900/40 border border-red-500/50 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
            <div className="text-9xl mb-6 flex justify-center drop-shadow-2xl">🐴</div>
            <div className="text-5xl font-black text-rose-500 mb-4 tracking-tighter uppercase">{donkey?.name || 'Unknown'} കഴുത</div>
         </div>

         <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 mt-8">
            <h3 className="uppercase tracking-widest text-xs text-white/40 border-b border-white/10 pb-2 mb-4">Results</h3>
            {[...gameState.players].sort((a, b) => (a.placement || 99) - (b.placement || 99)).map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0 border-white/5">
                    <span className="font-bold flex items-center space-x-2">
                        <span className="text-xl drop-shadow-md">{p.avatar || '🦊'}</span>
                        <span>{p.name}</span>
                        <span className="ml-2 text-sm text-orange-400">{getPlacementText(p.placement, p.id === gameState.donkeyId)}</span>
                    </span>
                    <span className="font-mono bg-white/10 px-3 py-1 rounded-full">{p.score} pts</span>
                </div>
            ))}
         </div>
         <div className="flex space-x-4 mt-8">
           {gameState.hostId === socket?.id && (
             <button 
               onClick={() => socket?.emit('startGame', gameState.roomId)}
               className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all font-bold uppercase tracking-widest"
             >
               Play Again
             </button>
           )}
           <button 
             onClick={() => {
               socket?.emit('leaveRoom', { roomId: gameState.roomId });
             }}
             className="px-8 py-4 bg-red-600/20 hover:bg-red-500/40 text-red-100 border border-red-500/30 rounded-xl transition-all font-bold uppercase tracking-widest"
           >
             Leave Room
           </button>
         </div>
         {gameState.hostId !== socket?.id && (
           <p className="text-white/50 text-sm mt-8 animate-pulse">Waiting for host to start a new game...</p>
         )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between items-center bg-[#2a1104] relative overflow-hidden text-white font-sans selection:bg-orange-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/40 via-[#2a1104] to-black opacity-80 pointer-events-none"></div>
      
      {/* HUD Header */}
      <div className="w-full p-6 flex justify-between items-center z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-white/40 mb-1">Room</span>
            <span className="font-mono bg-white/10 rounded px-2 py-1 text-sm font-bold text-orange-400 border border-orange-400/20">{gameState.roomId}</span>
        </div>
        
        <div className="flex space-x-6 items-center">
            <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-widest text-white/40 mb-1">Lead Suit</span>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-xl shadow-inner">
                    {gameState.leadSuit || <span className="opacity-20">-</span>}
                </div>
            </div>
            <button
                onClick={() => {
                  socket?.emit('leaveRoom', { roomId: gameState.roomId });
                }}
                className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
            >
                Leave
            </button>
        </div>
      </div>

      {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-500/80 backdrop-blur-md text-white px-6 py-2 rounded-full font-bold shadow-xl border border-red-400 z-50 uppercase text-xs tracking-widest"
          >
              {errorMsg}
          </motion.div>
      )}

      {/* Opponents & Table area */}
      <div className="flex-1 w-full relative perspective-[1000px] flex items-center justify-center p-4 min-h-[50vh]">
          
          <div className="absolute inset-0 pointer-events-none z-10">
                    {(me ? orderedPlayers.slice(1) : orderedPlayers).map((p) => {
                        const idx = orderedPlayers.findIndex(op => op.id === p.id);
                        const total = orderedPlayers.length;
                        const angle = (idx / total) * 2 * Math.PI + Math.PI / 2;
                        const rx = 35; // % from center x 
                        const ry = 40; // % from center y
                        const x = Math.cos(angle) * rx;
                        const y = Math.sin(angle) * ry;
                        
                        return (
                        <div 
                            key={p.id} 
                            className="flex flex-col items-center pointer-events-auto"
                            style={{
                                position: 'absolute',
                                top: `${50 + y}%`,
                                left: `${50 + x}%`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: 20
                            }}
                        >
                            <div className={`relative flex flex-col items-center bg-transparent transition-all ${p.isTurn ? 'scale-105' : ''}`}>
                                <div className="max-w-[70px] sm:max-w-[90px] truncate text-[10px] font-bold text-white/90 mb-2 uppercase tracking-wide bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">{p.name}</div>
                                
                                <div className="relative">
                                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-3xl transition-all border-[3px] bg-black/20 backdrop-blur-md
                                        ${p.isTurn ? 'border-[#a8ff60] shadow-[0_0_20px_rgba(168,255,96,0.6)] animate-[pulse_2s_ease-in-out_infinite]' : 'border-white/10'}
                                    `}>
                                        {p.avatar || '🦊'}
                                    </div>
                                    
                                    <div className="absolute -bottom-1 -right-1 bg-[#1a1a1a] border-[1.5px] border-white/20 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded z-30 shadow-md min-w-[20px] text-center">
                                        {p.hand.length}
                                    </div>
                                    
                                    {p.isOut && <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center z-20 font-bold uppercase tracking-widest text-xs text-orange-400 drop-shadow-md">{getPlacementText(p.placement, false)}</div>}
                                </div>

                                <div className="relative mt-2 h-10 w-full flex justify-center">
                                    {p.hand.slice(0, 10).map((_, i) => {
                                        const originalPlayerIndex = gameState.players.findIndex(player => player.id === p.id);
                                        const globalIndex = i * gameState.players.length + originalPlayerIndex;
                                        const count = Math.min(p.hand.length, 10);
                                        const arcSpread = count > 5 ? 50 : count * 10; 
                                        const cardAngle = count > 1 ? (i - (count - 1) / 2) * (arcSpread / (count - 1)) : 0;

                                        return (
                                          <motion.div
                                              layout
                                              key={i}
                                              className="absolute origin-top w-8 h-12"
                                              initial={isDealing ? { opacity: 0, scale: 0, y: 300 } : false}
                                              animate={{ 
                                                  opacity: 1, 
                                                  scale: 0.7, 
                                                  rotate: cardAngle,
                                                  y: Math.abs(cardAngle) * 0.15
                                              }}
                                              transition={{
                                                  delay: isDealing ? globalIndex * 0.07 : 0,
                                                  type: "spring",
                                                  stiffness: 300,
                                                  damping: 25
                                              }}
                                          >
                                              <CardComponent hidden mini className="shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                                          </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )})}
          </div>

          <AnimatePresence>
            {isDealing && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="absolute z-0 w-24 h-36"
                >
                    <div className="absolute inset-x-0 -top-8 flex items-center justify-center text-white/50 font-mono text-xs uppercase tracking-widest z-10 drop-shadow-md">Dealing...</div>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="absolute inset-0" style={{ transform: `rotate(${i * 4 - 10}deg) translateY(${i * -1}px)` }}>
                            <CardComponent hidden />
                        </div>
                    ))}
                </motion.div>
            )}
          </AnimatePresence>

          {/* Played Cards Area */}
          <div id="table-drop-zone" className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full flex flex-wrap items-center justify-center">
            <div className="absolute inset-0 bg-[#e8a264]/5 rounded-full blur-xl pointer-events-none"></div>
            <AnimatePresence>
                {gameState.tableCards.map((tc, index) => {
                    const angle = index * (360 / Math.max(gameState.players.length, 1));
                    return (
                        <motion.div 
                            layoutId={`card-${tc.card.suit}-${tc.card.rank}`}
                            key={`${tc.playerId}-${tc.card.suit}-${tc.card.rank}`}
                            initial={{ scale: 0, opacity: 0, y: -50, rotate: index * 10 - 20 }}
                            animate={{ 
                                scale: 0.8, 
                                opacity: 0.95,
                                x: Math.cos(angle * Math.PI / 180) * 15,
                                y: Math.sin(angle * Math.PI / 180) * 15,
                                rotate: angle + 90 + ((index * 7) % 5),
                                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))'
                            }}
                            style={{ zIndex: index + 10 }}
                            exit={{ 
                                opacity: 0, 
                                scale: 0.4, 
                                transition: { duration: 0.2 } // quick fade
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }} // fast slide
                            className="absolute"
                        >
                            <CardComponent card={tc.card} />
                        </motion.div>
                    )
                })}
            </AnimatePresence>
          </div>
      </div>

      {/* My Hand */}
      {me && (
        <div className="w-full flex justify-center items-end p-8 pb-12 z-20 relative">
            <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-8 flex flex-col items-center bg-transparent">
                <div className="max-w-[70px] sm:max-w-[90px] truncate text-[10px] font-bold text-white/90 mb-2 uppercase tracking-wide bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">{me.name}</div>
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-3xl transition-all border-[3px] bg-black/20 backdrop-blur-md
                    ${me.isTurn ? 'border-[#a8ff60] shadow-[0_0_20px_rgba(168,255,96,0.6)] animate-[pulse_2s_ease-in-out_infinite]' : 'border-white/10'}`}
                >
                    {me.avatar || '🦊'}
                </div>
                <div className="text-orange-400 font-mono text-[10px] uppercase tracking-widest mt-2 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">{me.score} pts</div>
            </div>
            
            {me.isTurn && !me.isOut && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-8">
                    <span className="bg-orange-500 text-black font-black uppercase tracking-widest text-xs px-6 py-2 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)] animate-pulse border border-orange-300">
                        Your Turn
                    </span>
                </div>
            )}
            
            <div className="flex justify-start sm:justify-center items-end -space-x-16 sm:-space-x-14 md:-space-x-12 px-12 pt-20 pb-8 w-full max-w-full overflow-x-auto overflow-y-visible z-10 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                <AnimatePresence>
                    {me.hand.map((card, idx) => {
                        const canPlay = me.isTurn; 
                        const count = me.hand.length;
                        const maxSpread = count > 15 ? 60 : 45;
                        const fanAngle = count > 1 ? (idx - (count - 1) / 2) * (maxSpread / (count - 1)) : 0;
                        const arcY = Math.abs(fanAngle) * 0.8;
                        const globalIndex = idx * gameState.players.length + myIndex;
                        const isShaking = shakeCardStr === `${card.suit}-${card.rank}`;
                        
                        const handleDragEnd = (e: any, info: any) => {
                            if (!canPlay) return;
                            const element = document.elementFromPoint(info.point.x, info.point.y);
                            if (element && element.closest('#table-drop-zone')) {
                                handlePlayCard(card);
                            }
                        };
                        
                        const isPlayableObj = canPlay && (!gameState.leadSuit || card.suit === gameState.leadSuit || !me.hand.some(c => c.suit === gameState.leadSuit));
                        
                        return (
                            <motion.div
                                layout
                                layoutId={`card-${card.suit}-${card.rank}`}
                                key={`${card.suit}-${card.rank}`}
                                drag={canPlay && isPlayableObj}
                                dragSnapToOrigin={true}
                                dragElastic={0.2}
                                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                                onDragEnd={handleDragEnd}
                                initial={isDealing ? { y: -300, scale: 0, opacity: 0 } : { y: 50, opacity: 0 }}
                                animate={isShaking ? {
                                    x: [-5, 5, -5, 5, 0],
                                    rotate: [fanAngle - 5, fanAngle + 5, fanAngle - 5, fanAngle + 5, fanAngle],
                                    transition: { duration: 0.4 }
                                } : { 
                                    y: ((isPlayableObj && canPlay) ? -15 : 0) + arcY, 
                                    opacity: 1, 
                                    rotate: fanAngle,
                                    x: 0,
                                    scale: 1,
                                    zIndex: 1
                                }}
                                whileHover={canPlay && !isShaking ? { y: (isPlayableObj ? -35 : -20) + arcY, scale: 1.05, zIndex: 50 } : {}}
                                whileDrag={canPlay && !isShaking ? { scale: 1.1, zIndex: 100 } : {}}
                                exit={{ y: -100, opacity: 0, scale: 0 }}
                                transition={{ 
                                    type: "spring", 
                                    stiffness: 350, 
                                    damping: 25,
                                    delay: isDealing ? globalIndex * 0.07 : 0
                                }}
                                className={`shrink-0 relative ${canPlay ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                                <div className={isPlayableObj && canPlay && !isDealing ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#2a1104] rounded-lg shadow-[0_0_15px_rgba(250,204,21,0.5)]' : ''}>
                                    <CardComponent 
                                        card={card} 
                                        playable={canPlay} 
                                        hidden={isDealing}
                                        onClick={() => handlePlayCard(card)} 
                                        className="transition-shadow duration-200 hover:shadow-[0_0_25px_rgba(249,115,22,0.5)] shadow-black/90 cursor-pointer"
                                    />
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
            
            {me.isOut && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center">
                    <div className="text-center">
                        <div className="font-serif italic text-4xl text-white/50 tracking-widest mb-2">You finished your cards</div>
                        <div className="text-5xl font-black text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                           {getPlacementText(me.placement, false)}
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Chat Box */}
      {socket && me && <ChatBox socket={socket} roomId={gameState.roomId} playerName={me.name} />}
    </div>
  );
}
