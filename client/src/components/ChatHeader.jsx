import React from 'react';
import { Link } from 'react-router-dom';
import { CHAT_HEADER_SUBTITLE, CHAT_HEADER_TITLE } from '../constants/chatConstants';

//No Props Provided
const ChatHeader = () => {
  return (
    <div className="chat-header">
      <h1>{CHAT_HEADER_TITLE}</h1>
      <p>{CHAT_HEADER_SUBTITLE}</p>
      <Link to="/about-data">Click Here to see About Data</Link>
    </div>
  );
};

export default ChatHeader;
