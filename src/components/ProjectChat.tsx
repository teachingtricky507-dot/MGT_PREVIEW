import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { chatService } from '../services/firebaseService';
import { Message, User } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface ProjectChatProps {
  projectId: string;
  members: User[];
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectChat: React.FC<ProjectChatProps> = ({ projectId, members, isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projectId && isOpen) {
      const unsub = chatService.subscribeToMessages(projectId, setMessages);
      return unsub;
    }
  }, [projectId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userProfile) return;

    const content = newMessage.trim();
    setNewMessage('');
    
    await chatService.sendMessage(projectId, {
      senderId: userProfile.uid,
      content
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <MessageSquare size={18} className="text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172B4D]">Team Chat</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{members.length} members</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-400"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                <MessageSquare size={32} className="text-gray-300" />
                <p className="text-xs font-medium text-gray-500">No messages yet.<br/>Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const sender = members.find(m => m.uid === msg.senderId);
                const isMe = msg.senderId === userProfile?.uid;
                const showAvatar = i === 0 || messages[i-1].senderId !== msg.senderId;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showAvatar ? 'mt-2' : 'mt-1'}`}>
                    {!isMe && showAvatar && (
                      <span className="text-[10px] font-bold text-gray-400 ml-9 mb-1 uppercase tracking-wider">
                        {sender?.displayName || 'Unknown User'}
                      </span>
                    )}
                    <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && (
                        <div className="w-7">
                          {showAvatar ? (
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={sender?.photoURL} />
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-[10px] font-bold">
                                {sender?.displayName?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ) : null}
                        </div>
                      )}
                      
                      <div className={`group relative px-3 py-2 rounded-2xl text-sm ${
                        isMe 
                          ? 'bg-[#0052CC] text-white rounded-tr-none' 
                          : 'bg-gray-100 text-[#172B4D] rounded-tl-none'
                      }`}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <span className={`absolute top-full mt-1 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${
                          isMe ? 'right-0' : 'left-0'
                        } text-gray-400`}>
                          {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : 'Sending...'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-50">
            <form onSubmit={handleSendMessage} className="relative">
              <Input
                placeholder="Message team..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="pr-12 bg-gray-50 border-none focus:ring-1 focus:ring-blue-100 rounded-xl h-10 text-sm"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!newMessage.trim()}
                className="absolute right-1 top-1 h-8 w-8 rounded-lg bg-transparent hover:bg-blue-50 text-blue-500 shadow-none"
              >
                <Send size={16} />
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
