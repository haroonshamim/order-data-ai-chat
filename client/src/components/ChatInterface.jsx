//Importing Libraries and Styles      
import React, { useState, useRef, useEffect } from 'react';
//This library is used to make HTTP requests from the frontend to the backend API. 
//It simplifies the process of sending asynchronous requests and handling responses, making it easier to communicate with the server and retrieve data or send user input for processing.
import axios from 'axios';
//Importing the css style for the chat interface
import './ChatInterface.css';

const API_BASE = process.env.REACT_APP_API_URL;
console.log('[ChatInterface] API URL:', API_BASE, 'NODE_ENV:', process.env.NODE_ENV);


/*
React Component This component represents the chat interface of the application. It manages the state of messages, user input, and loading status. It also handles sending messages to the backend API and displaying responses from the AI model.
const ChatInterface = () => {
  // 1. STATE — variables that store data
  // 2. REFS — references to DOM elements
  // 3. FUNCTIONS — logic and actions
  // 4. EFFECTS — code that runs when something changes
  // 5. RETURN — the actual UI (JSX)
} 

  //Use State: useState() returns two values: [stateVariable, functionToUpdateState] 
  //Messages State (Variable): This state variable holds an array of message objects, where each object represents a message in the chat.   Each message has a type (either 'bot' or 'user') and the text content of the message. The initial state contains a welcome message from the bot. MESSAGE Is An Object = [{type:'bot', text:'...'}] 
  // const [value, setValue] = useState(initialValue) value — the current stored value setValue — the function to update it initialValue — what it starts as (runs only once) Simple example: jsconst [count, setCount] = useState(0) // Later... setCount(5) // count is now 5, component re-renders */

const ChatInterface=()=>{ 
  const [messages,setMessages]=useState(
    
    //This is initial Data for the chat interface, which contains a welcome message from the bot.
    [
    {
      type:'bot',
      text: 'Hi! 👋 I can help you analyze your order data. Ask me questions like:\n• "What was the total revenue in January?"\n• "Which product sold the most?"\n• "Show me the top 3 customers by total spend"',
    },
  ]);



  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  //useRef creates a reference to a DOM element — essentially a way to directly point to an HTML element on the page.
  //useRef(null) — starts as null because the element doesn't exist yet when the component first loads. Once the component renders, React fills it in automatically.
  const messagesEndRef = useRef(null);

  //A function//Component that scrolls the chat to the bottom whenever a new message is added. It uses the reference created by useRef to access the DOM element and scroll it into view smoothly.
  //.current: This accesses the actual DOM element that useRef is pointing to messages EndRef is just the ref object — .current is what's inside it (the real HTML element)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  //useEffect is a React Hook that runs side effects — code that needs to execute after something happens in your component.Every time messages changes, it runs scrollToBottom()
  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const sendMessage=async(e)=>
  {
    //Stops the form from refreshing the page (default browser behavior) Normally when a form submits: Page refreshes and all state is lost. e.preventDefault() prevents that, allowing us to handle the form submission with our own JavaScript code without refreshing the page.
    e.preventDefault();
    //Trim removes whitespace from both ends of a string. If the input is empty or just spaces, it returns an empty string. !input.trim() checks if the trimmed input is empty, and if so, it returns early from the function, preventing the message from being sent.
    if(!input.trim()) return;
    //Store Input message from user
    const userMessage=input;

    //This line adds a new user message to the existing messages array without deleting the old ones.
    //It uses the setMessages function to update the state. The new state is created by taking the previous messages (prev) and spreading them into a new array, then adding a new message object with type 'user' and the text of the user's message.
    /*  
      // Option 1 — named function defined separately
      const appendNewValue = (prev) => [...prev, { type: 'user', text: userMessage }]
      setMessages(appendNewValue)
      // Option 2 — inline arrow function
      setMessages((prev) => [...prev, { type: 'user', text: userMessage }])
      // Option 3 — two steps
      const newMessages = [...messages, { type: 'user', text: userMessage }]
      setMessages(newMessages)
    */

    const appendnewvalue=(prev)=>[...prev,{type:'user',text:userMessage}]
    setMessages(appendnewvalue);
    //Clear Input Field
    setInput('');
    setLoading(true);
    try
    {
      if (!API_BASE) {
        throw new Error('REACT_APP_API_URL is undefined. Check your .env file and restart the dev server.');
      }

      //axios.post — sends a POST request to a backend server with two arguments: the URL of the API endpoint and the data payload (in this case, an object containing the user's message).
        const response=await axios.post(
          API_BASE,
          {message:userMessage}
        );
        /* 
        response.data is what the server sent back — it looks something like this:
         response.data = {
         aiResponse: 'Total revenue in January was $5000',
         sqlQuery: 'SELECT SUM(amount) FROM orders WHERE month = 1',
         results: [{ total: 5000 }]
        } */

         // It is same as const aiResponse = response.data.response   // the AI's text answe 
         // const sqlQuery   = response.data.sqlQuery   // the SQL query that was run  
         // const results    = response.data.results    // the raw data returned


        const {response:aiResponse,sqlQuery,results}=response.data;
   
        //Now we are going to update the messages
        const appendnewvalue=(prev)=>[...prev,{type:'bot',text:aiResponse,sql:sqlQuery,data:results}]
        setMessages(appendnewvalue);


    }
    catch(error)
    {
      console.error('Chat error:', error);
         setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          text: 'Error: ' + (error.response?.data?.error || 'I am unable to get the response. You can try again!'),
        },
      ]);
    }
    finally
    {
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