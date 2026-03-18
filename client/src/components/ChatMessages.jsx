import React from 'react';
import { CHAT_LOADING_TEXT } from '../constants/chatConstants';

const ChatMessages = ({ messages, loading, messagesEndRef }) => {
  return (
    <div className="messages">
      {messages.map((msg, idx) => (
        <div key={idx} className={`message ${msg.type}`}>
          <div className="message-content">
            <p>{msg.text}</p>
            {msg.sql && (
              <details className="sql-details" style={{ display: 'none' }}>
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
            <p>{CHAT_LOADING_TEXT}</p>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
