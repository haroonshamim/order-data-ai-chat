import React from 'react';
import { CHAT_INPUT_PLACEHOLDER } from '../../constants/chatConstants';

/*
The Props (Parameters)
{ input, loading, onInputChange, onSubmit }
These are destructured from the props object — shorthand for props.input, props.loading, etc.

*/
const ChatInputForm = ({ input, loading, onInputChange, onSubmit }) => {
  return (
    <form onSubmit={onSubmit} className="input-form">
      <input
        type="text"
        value={input}
        onChange={onInputChange}
        placeholder={CHAT_INPUT_PLACEHOLDER}
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        Send
      </button>
    </form>
  );
};

export default ChatInputForm;
