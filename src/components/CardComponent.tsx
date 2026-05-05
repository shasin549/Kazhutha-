import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { Card as CardType } from '../shared/types';

interface CardProps {
  key?: React.Key;
  card?: CardType;
  hidden?: boolean;
  playable?: boolean;
  onClick?: () => void;
  className?: string;
  mini?: boolean;
}

export function CardComponent({ card, hidden, playable, onClick, className = '', mini }: CardProps) {
  const isRed = card?.suit === '♥️' || card?.suit === '♦️';

  return (
    <div
      onClick={playable && !hidden ? onClick : undefined}
      className={`relative perspective-1000 ${className}`}
      style={{ perspective: 1000 }}
    >
      <AnimatePresence initial={false} mode="wait">
        {hidden ? (
          <motion.div
            key="back"
            initial={{ rotateY: 90 }}
            animate={{ rotateY: 0 }}
            exit={{ rotateY: -90 }}
            transition={{ duration: 0.2 }}
            className={`relative rounded border border-white/10 bg-gradient-to-br from-indigo-900 to-slate-900 shadow-xl ${mini ? 'w-8 h-12' : 'w-24 h-36 rounded-xl'} flex items-center justify-center`}
          >
            <div className={`absolute inset-1 border border-dashed border-white/20 rounded-sm ${mini ? '' : 'inset-2 border-2 rounded-lg'}`}></div>
            {!mini && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <span className="text-white/50 text-xl font-serif">?</span>
                </div>
            )}
          </motion.div>
        ) : card ? (
          <motion.div
            key="front"
            initial={{ rotateY: 90 }}
            animate={{ rotateY: 0 }}
            exit={{ rotateY: -90 }}
            transition={{ duration: 0.2 }}
            className={`relative border border-white bg-white shadow-2xl ${mini ? 'w-8 h-12 text-[10px] rounded p-1' : 'w-24 h-36 text-lg rounded-xl p-2'} flex flex-col justify-between select-none ${playable ? 'cursor-pointer hover:shadow-cyan-500/20' : ''}`}
          >
            <div className={`font-bold flex items-center ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
              <span>{card.rank}</span>
              <span className="ml-0.5 text-sm">{card.suit}</span>
            </div>
            
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl opacity-20 ${isRed ? 'text-red-500' : 'text-slate-900'}`}>
              {card.suit}
            </div>

            <div className={`font-bold flex items-center justify-end rotate-180 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
              <span>{card.rank}</span>
              <span className="ml-0.5 text-sm">{card.suit}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
