import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { INITIAL_BOT_MESSAGE } from '../../constants/chatConstants';

const API_BASE = process.env.REACT_APP_API_URL;

export default function useChat() {
  const [messages, setMessages] = useState([INITIAL_BOT_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((prev) => [...prev, { type: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      if (!API_BASE) {
        throw new Error('REACT_APP_API_URL is undefined. Check your .env file and restart the dev server.');
      }

      const response = await axios.post(API_BASE, { message: userMessage });
      const { response: aiResponse, sqlQuery, results } = response.data;

      setMessages((prev) => [...prev, { type: 'bot', text: aiResponse, sql: sqlQuery, data: results }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: 'Error: ' + (error.response?.data?.error || 'I am unable to get the response. You can try again!'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    input,
    setInput,
    loading,
    sendMessage,
    messagesEndRef,
  };
}
