import { useState, useRef, useEffect } from 'react';
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

  const appendToBotMessage = (id, chunk) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, text: `${msg.text || ''}${chunk}` }
          : msg
      )
    );
  };

  const updateBotMessage = (id, patch) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg))
    );
  };

  const sendMessage = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const timestamp = Date.now();
    const botMessageId = `bot-${timestamp}`;

    setMessages((prev) => [
      ...prev,
      { id: `user-${timestamp}`, type: 'user', text: userMessage },
      { id: botMessageId, type: 'bot', text: '', sql: null, data: null }
    ]);
    setInput('');
    setLoading(true);

    try {
      if (!API_BASE) {
        throw new Error('REACT_APP_API_URL is undefined. Check your .env file and restart the dev server.');
      }

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream'
        },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;

        try {
          const errorJson = await response.json();
          errorMessage = errorJson?.error || errorMessage;
        } catch {
          // ignore JSON parse failure for streaming error bodies
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('Streaming response is not available in this browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvent = (rawEvent) => {
        const lines = rawEvent.split('\n');
        let eventName = 'message';
        let dataText = '';

        lines.forEach((line) => {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataText += line.slice(5).trim();
          }
        });

        if (!dataText) return;

        let payload;
        try {
          payload = JSON.parse(dataText);
        } catch {
          return;
        }

        if (eventName === 'token') {
          appendToBotMessage(botMessageId, payload.content || '');
          return;
        }

        if (eventName === 'tool-result') {
          updateBotMessage(botMessageId, {
            sql: payload.sqlQuery,
            data: payload.results
          });
          return;
        }

        if (eventName === 'done') {
          updateBotMessage(botMessageId, {
            text: payload.response || '',
            sql: payload.sqlQuery,
            data: payload.results
          });
          return;
        }

        if (eventName === 'error') {
          updateBotMessage(botMessageId, {
            text: `Error: ${payload.error || 'I am unable to get the response. You can try again!'}`
          });
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        events.forEach(processEvent);
      }

      if (buffer.trim()) {
        processEvent(buffer);
      }
    } catch (error) {
      console.error('Chat error:', error);
      updateBotMessage(botMessageId, {
        text: `Error: ${error.message || 'I am unable to get the response. You can try again!'}`
      });
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
