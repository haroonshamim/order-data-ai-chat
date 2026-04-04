import React from 'react';
import { CHAT_LOADING_TEXT } from '../../constants/chatConstants';

const ChatMessages = ({ messages, loading, messagesEndRef }) => {
  const visibleMessages = messages.filter(
    (msg) => msg.type === 'user' || msg.text || msg.sql || msg.data
  );
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const showLoading = loading && lastVisibleMessage?.type !== 'bot';

  return (
    <div className="messages">
      {visibleMessages.map((msg, idx) => (
        <div key={msg.id || idx} className={`message ${msg.type}`}>
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
      {showLoading && (
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
