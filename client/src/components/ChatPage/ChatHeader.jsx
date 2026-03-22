import React from 'react';
import { Link } from 'react-router-dom';
import { CHAT_HEADER_SUBTITLE, CHAT_HEADER_TITLE } from '../../constants/chatConstants';

//No Props Provided
const ChatHeader = () => {
  return (
    <div className="chat-header">
      <h1>{CHAT_HEADER_TITLE}</h1>
      <p>{CHAT_HEADER_SUBTITLE}</p>
      <Link to="/about-data" className="about-link">See About Data</Link>
    </div>
  );
};

export default ChatHeader;

/*
 navigation within the app is primarily handled using the <Link> component from the React Router library, rather than the standard HTML anchor (<a>) tag. The HTML <a> tag works in React, but it causes a full page reload, which goes against the principles of a Single Page Application (SPA).
 The <Link> component, on the other hand, allows for client-side navigation without triggering a full page reload. When you click on a <Link>, React Router intercepts the click event and updates the URL in the browser's address bar without refreshing the page. This allows for a smoother user experience and faster navigation between different parts of the app.
*/
