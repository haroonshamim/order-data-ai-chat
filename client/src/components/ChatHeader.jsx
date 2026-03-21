import React from 'react';
import { Link } from 'react-router-dom';
import { CHAT_HEADER_SUBTITLE, CHAT_HEADER_TITLE } from '../constants/chatConstants';

//No Props Provided
const ChatHeader = () => {
  return (
    <div className="chat-header">
      <h1>{CHAT_HEADER_TITLE}</h1>
      <p>{CHAT_HEADER_SUBTITLE}</p>
      <Link
        to="/about-data"
        style={{
          display: 'inline-block',
          marginTop: 18,
          padding: '12px 25px',
          background: '#ffcf32',
          color: '#fff',
          borderRadius: 50,
          fontWeight: 600,
          textDecoration: 'none',
          color: '#000000',
        }}
      >
        See About Data
      </Link>
    </div>
  );
};

export default ChatHeader;
