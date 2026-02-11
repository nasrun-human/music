import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, X, Send } from 'lucide-react';

const ChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user && isOpen) {
      socketRef.current = io('http://localhost:3000');
      
      socketRef.current.emit('join_chat', { username: user.username, id: user.id });

      // Load initial messages (optional, if we added an API for it)
      fetch('http://localhost:3000/api/messages', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error(err));

      socketRef.current.on('receive_message', (message) => {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      });

      return () => {
        socketRef.current.disconnect();
      };
    }
  }, [user, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && socketRef.current) {
      const messageData = {
        sender_id: user.id,
        username: user.username,
        avatar: user.avatar,
        content: input,
        created_at: new Date().toISOString()
      };
      
      socketRef.current.emit('send_message', messageData);
      // Optimistic update not needed as we get receive_message back, but good for latency
      // setMessages((prev) => [...prev, messageData]); 
      setInput('');
    }
  };

  if (!user) return null; // Only show chat for logged in users

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="bg-gray-800 rounded-lg shadow-2xl w-80 h-96 flex flex-col border border-gray-700">
          <div className="p-3 bg-gray-900 rounded-t-lg flex justify-between items-center border-b border-gray-700">
            <h3 className="font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" /> Community Chat
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-800/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.username === user.username ? 'flex-row-reverse' : ''}`}>
                <img src={msg.avatar || `https://ui-avatars.com/api/?name=${msg.username}`} alt={msg.username} className="w-8 h-8 rounded-full bg-gray-700" />
                <div className={`max-w-[75%] rounded-lg p-2 text-sm ${msg.username === user.username ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                  <p className="font-bold text-xs opacity-75 mb-1">{msg.username}</p>
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 bg-gray-900 rounded-b-lg flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 text-white rounded px-3 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
            />
            <button type="submit" className="text-purple-500 hover:text-purple-400">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
