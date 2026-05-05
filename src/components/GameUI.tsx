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

export function GameUI({ socket, gameState }: GameUIProps) {
  const me = gameState.players.find(p => p.id === socket?.id);
  const myIndex = gameState.players.findIndex(p => p.id === socket?.id);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDealing, setIsDealing] = useState(false);

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
    socket.emit('playCard', { roomId: gameState.roomId, card });
  };

  if (gameState.status === 'finished') {
    const donkey = gameState.players.find(p => p.id === gameState.donkeyId);
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 p-12 text-center text-white">
         <h1 className="text-6xl font-serif text-amber-500 tracking-widest drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">GAME OVER</h1>
         
         <div className="bg-red-900/40 border border-red-500/50 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20"></div>
            <h2 className="text-sm font-mono uppercase tracking-widest text-red-300 mb-2">The കഴുതകളി Is</h2>
            <div className="text-5xl font-black text-rose-500 mb-4 tracking-tighter uppercase">{donkey?.name || 'Unknown'}</div>
            <p className="text-rose-200/60 italic font-serif">Hee-haw!</p>
         </div>

         <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 mt-8">
            <h3 className="uppercase tracking-widest text-xs text-white/40 border-b border-white/10 pb-2 mb-4">Penalty Points</h3>
            {gameState.players.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0 border-white/5">
                    <span className="font-bold">{p.name} {p.id === gameState.donkeyId ? '🐴' : ''}</span>
                    <span className="font-mono bg-white/10 px-3 py-1 rounded-full">{p.score} pts</span>
                </div>
            ))}
         </div>
         {gameState.hostId === socket?.id && (
           <button 
             onClick={() => socket?.emit('startGame', gameState.roomId)}
             className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all font-bold uppercase tracking-widest mt-8"
           >
             Play Again
           </button>
         )}
         {gameState.hostId !== socket?.id && (
           <p className="text-white/50 text-sm mt-8 animate-pulse">Waiting for host to start a new game...</p>
         )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col justify-between items-center bg-[#072418] relative overflow-hidden text-white font-sans selection:bg-emerald-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-[#072418] to-black opacity-80 pointer-events-none"></div>
      
      {/* HUD Header */}
      <div className="w-full p-6 flex justify-between items-center z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-white/40 mb-1">Room</span>
            <span className="font-mono bg-white/10 rounded px-2 py-1 text-sm font-bold text-emerald-400 border border-emerald-400/20">{gameState.roomId}</span>
        </div>
        
        <div className="flex flex-col items-end">
            <span className="text-xs uppercase tracking-widest text-white/40 mb-1">Lead Suit</span>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-xl shadow-inner">
                {gameState.leadSuit || <span className="opacity-20">-</span>}
            </div>
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
      <div className="flex-1 w-full relative perspective-[1000px] flex items-center justify-center p-4">
          
          <div className="absolute top-4 left-0 w-full flex justify-center items-center px-4 flex-wrap gap-4 z-10">
                  {(me ? orderedPlayers.slice(1) : orderedPlayers).map((p) => (
                      <div key={p.id} className="flex flex-col items-center">
                          <div className={`relative px-4 py-2 rounded-xl border ${p.isTurn ? 'bg-emerald-600/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/5 border-white/10'} backdrop-blur-sm transition-all text-center min-w-[100px]`}>
                              {p.isOut && <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-20 font-bold uppercase tracking-widest text-xs text-rose-400">OUT</div>}
                              <h3 className="font-bold text-sm tracking-widest">{p.name}</h3>
                              <div className="flex -space-x-4 mt-2 justify-center">
                                  {p.hand.map((_, i) => {
                                      const originalPlayerIndex = gameState.players.findIndex(player => player.id === p.id);
                                      const globalIndex = i * gameState.players.length + originalPlayerIndex;
                                      return (
                                        <motion.div
                                            layout
                                            key={i}
                                            initial={isDealing ? { opacity: 0, scale: 0, y: 300 } : false}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{
                                                delay: isDealing ? globalIndex * 0.07 : 0,
                                                type: "spring",
                                                stiffness: 300,
                                                damping: 25
                                            }}
                                        >
                                            <CardComponent hidden mini className="shadow-black/50" />
                                        </motion.div>
                                      );
                                  })}
                              </div>
                              <p className="text-[10px] uppercase font-mono text-white/30 mt-2 tracking-widest">{p.hand.length} cards</p>
                              {p.isTurn && <div className="absolute -bottom-2 -translate-x-1/2 left-1/2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white animate-ping"></div></div>}
                          </div>
                      </div>
                  ))}
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
          <div id="table-drop-zone" className="relative w-64 h-64 border-4 border-dashed border-white/10 rounded-full flex flex-wrap items-center justify-center">
            <div className="absolute inset-0 bg-emerald-900/10 rounded-full blur-2xl pointer-events-none"></div>
            <AnimatePresence>
                {gameState.tableCards.map((tc, index) => {
                    const isWinner = gameState.roundWinnerId === tc.playerId;
                    return (
                        <motion.div 
                            layoutId={`card-${tc.card.suit}-${tc.card.rank}`}
                            key={`${tc.playerId}-${tc.card.suit}-${tc.card.rank}`}
                            initial={{ scale: 0, opacity: 0, y: -80, rotate: index * 15 - 30 }}
                            animate={{ 
                                scale: isWinner ? 1.3 : 1, 
                                opacity: 1,
                                y: 0,
                                rotate: isWinner ? 0 : index * 15 - 30,
                                filter: isWinner ? 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.8))' : 'drop-shadow(0 0 5px rgba(0,0,0,0.5))'
                            }}
                            style={{ zIndex: isWinner ? 50 : index + 10 }}
                            exit={{ 
                                opacity: 0, 
                                scale: 0.5, 
                                y: 150,
                                transition: { duration: 0.3 }
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
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
            {me.isTurn && !me.isOut && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-8">
                    <span className="bg-emerald-500 text-black font-black uppercase tracking-widest text-xs px-6 py-2 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-pulse border border-emerald-300">
                        Your Turn
                    </span>
                </div>
            )}
            
            <div className="flex justify-start sm:justify-center items-end -space-x-16 sm:-space-x-14 md:-space-x-12 px-12 pt-20 pb-8 w-full max-w-full overflow-x-auto overflow-y-visible z-10 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                <AnimatePresence>
                    {me.hand.map((card, idx) => {
                        const canPlay = me.isTurn; 
                        const fanAngle = (idx - (me.hand.length - 1) / 2) * (me.hand.length > 20 ? 1 : 1.5);
                        const globalIndex = idx * gameState.players.length + myIndex;
                        
                        const handleDragEnd = (e: any, info: any) => {
                            if (!canPlay) return;
                            const element = document.elementFromPoint(info.point.x, info.point.y);
                            if (element && element.closest('#table-drop-zone')) {
                                handlePlayCard(card);
                            }
                        };
                        
                        return (
                            <motion.div
                                layout
                                layoutId={`card-${card.suit}-${card.rank}`}
                                key={`${card.suit}-${card.rank}`}
                                drag={canPlay}
                                dragSnapToOrigin={true}
                                dragElastic={0.2}
                                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                                onDragEnd={handleDragEnd}
                                initial={isDealing ? { y: -300, scale: 0, opacity: 0 } : { y: 50, opacity: 0 }}
                                animate={{ 
                                    y: 0, 
                                    opacity: 1, 
                                    rotate: fanAngle,
                                    x: 0,
                                    scale: 1,
                                    zIndex: 1
                                }}
                                whileHover={canPlay ? { y: -20, scale: 1.05, zIndex: 50 } : {}}
                                whileDrag={canPlay ? { scale: 1.1, zIndex: 100 } : {}}
                                exit={{ y: -100, opacity: 0, scale: 0 }}
                                transition={{ 
                                    type: "spring", 
                                    stiffness: 350, 
                                    damping: 25,
                                    delay: isDealing ? globalIndex * 0.07 : 0
                                }}
                                className={`shrink-0 relative ${canPlay ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            >
                                <CardComponent 
                                    card={card} 
                                    playable={canPlay} 
                                    hidden={isDealing}
                                    onClick={() => handlePlayCard(card)} 
                                    className="transition-shadow duration-200 hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] shadow-black/90 cursor-pointer"
                                />
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
            
            {me.isOut && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center">
                    <span className="font-serif italic text-4xl text-white/50 tracking-widest">You have no cards left</span>
                </div>
            )}
        </div>
      )}

      {/* Chat Box */}
      {socket && me && <ChatBox socket={socket} roomId={gameState.roomId} playerName={me.name} />}
    </div>
  );
}
