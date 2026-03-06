import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatInterface.css';

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: 'Hi! 👋 I can help you analyze your order data. Ask me questions like:\n• "What was the total revenue in January?"\n• "Which product sold the most?"\n• "Show me the top 3 customers by total spend"',
    },
  ]);
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
    e.preventDefault();

    if (!input.trim()) return;

    // Add user message
    const userMessage = input;
    setMessages((prev) => [...prev, { type: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/chat',
        { message: userMessage }
      );

      const { response: aiResponse, sqlQuery, results } = response.data;

      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: aiResponse,
          sql: sqlQuery,
          data: results,
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: '❌ Error: ' + (error.response?.data?.error || 'Failed to get response'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>📊 Order Analytics AI Chat</h1>
        <p>Ask natural language questions about your order data</p>
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.type}`}>
            <div className="message-content">
              <p>{msg.text}</p>
              {msg.sql && (
                <details className="sql-details">
                  <summary>View SQL Query</summary>
                  <code>{msg.sql}</code>
                </details>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message bot">
            <div className="message-content">
              <p>🔄 Processing your question...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your orders..."
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;