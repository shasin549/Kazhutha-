import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface ChatBoxProps {
  socket: Socket | null;
  roomId: string;
  playerName: string;
}

export function ChatBox({ socket, roomId, playerName }: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [popupMessage, setPopupMessage] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    
    const handleChatMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
        setPopupMessage(msg);
      }
    };

    socket.on('chatMessage', handleChatMessage);
    return () => {
      socket.off('chatMessage', handleChatMessage);
    };
  }, [socket, isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
      setPopupMessage(null);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (popupMessage) {
      const timer = setTimeout(() => {
        setPopupMessage(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [popupMessage]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: socket.id || '',
      senderName: playerName,
      text: newMessage.trim(),
      timestamp: Date.now(),
    };

    socket.emit('chatMessage', { roomId, message: msg });
    setMessages(prev => [...prev, msg]);
    setNewMessage('');
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 z-40 ${
          isOpen ? 'opacity-0 scale-50 pointer-events-none' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:scale-105 opacity-100 scale-100'
        }`}
      >
        <MessageSquare className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Message Popup Toast */}
      <AnimatePresence>
        {!isOpen && popupMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-24 right-8 bg-indigo-600/90 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl max-w-[250px] z-40 pointer-events-none border border-white/10"
          >
            <div className="text-[10px] text-indigo-200 mb-0.5 font-bold uppercase tracking-widest">{popupMessage.senderName}</div>
            <div className="text-sm truncate">{popupMessage.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-8 right-8 w-80 sm:w-96 h-[500px] max-h-[80vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 backdrop-blur-md text-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/80">
              <h3 className="font-bold tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Room Chat
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-white/40 italic mt-10">No messages yet. Say hi!</div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === socket?.id;
                  const showName = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showName && (
                        <span className="text-[10px] text-white/50 mb-1 ml-1 tracking-wider">
                          {isMe ? 'You' : msg.senderName}
                        </span>
                      )}
                      <div 
                        className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${
                          isMe 
                            ? 'bg-indigo-600 rounded-tr-sm text-indigo-50' 
                            : 'bg-slate-700 rounded-tl-sm text-slate-100'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-3 border-t border-white/10 bg-slate-800/50">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-slate-900 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-white/30"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
