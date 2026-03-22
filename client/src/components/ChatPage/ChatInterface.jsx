import React from 'react';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInputForm from './ChatInputForm';
import useChat from './useChat';
import './ChatInterface.css';


const ChatInterface = () => {
  const { messages, input, setInput, loading, sendMessage, messagesEndRef } = useChat();

  return (
    <div className="chat-container">
      {/* The ChatHeader component displays the title and subtitle of the chat interface, along with a link to the "About Data" page. It does not receive any props. */}
      <ChatHeader />
      <ChatMessages messages={messages} loading={loading} messagesEndRef={messagesEndRef} />
      <ChatInputForm input={input} loading={loading} onInputChange={(e) => setInput(e.target.value)} onSubmit={sendMessage} />
    </div>
  );
};

export default ChatInterface;
/*
Notes
-------------------------1------------------------
  REACT COMPONENT FLOW:
                This component represents the chat interface of the application. It manages the state of messages, user input, and loading status. It also handles sending messages to the backend API and displaying responses from the AI model.
                const ChatInterface = () => {
                  // 1. STATE — variables that store data
                  // 2. REFS — references to DOM elements
                  // 3. FUNCTIONS — logic and actions
                  // 4. EFFECTS — code that runs when something changes
                  // 5. RETURN — the actual UI (JSX)
                } 
-------------------------2------------------------
  //Use State: useState() returns two values: [stateVariable, functionToUpdateState] 
  //Messages State (Variable): This state variable holds an array of message objects, where each object represents a message in the chat.   Each message has a type (either 'bot' or 'user') and the text content of the message. The initial state contains a welcome message from the bot. MESSAGE Is An Object = [{type:'bot', text:'...'}] 
  // const [value, setValue] = useState(initialValue) value — the current stored value setValue — the function to update it initialValue — what it starts as (runs only once) Simple example: jsconst [count, setCount] = useState(0) // Later... setCount(5) // count is now 5, component re-renders 
-------------------------3------------------------
  //useRef creates a reference to a DOM element — essentially a way to directly point to an HTML element on the page.
  //useRef(null) — starts as null because the element doesn't exist yet when the component first loads. Once the component renders, React fills it in automatically.

*/