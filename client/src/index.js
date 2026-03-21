import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { BrowserRouter } from 'react-router-dom';
// ...other imports...

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
reportWebVitals();



/*
NOTES
--------------
document.getElementById('root') — finds an existing HTML element with id="root" (typically a <div> in your index.html)
ReactDOM.createRoot(...) — creates a React "root", which is React 18's way of taking control of that DOM element and managing everything rendered inside it
const root = ... — stores the root so you can call root.render(<App />) on it to actually display your React component tree
--------------
The bundler injects your JS bundle into that specific HTML file via a <script> tag, so when the browser loads it, your JS runs and document.getElementById('root') searches that page's DOM for an element with id="root".
If you had multiple HTML files, document.getElementById('root') would only search whichever HTML page is currently loaded in the browser — it has no awareness of other files. You'd need to either:
Make sure each HTML file has a <div id="root"> if they all use the same script
Or configure your bundler with multiple entry points, one JS file per HTML page
The key mental model: document.getElementById('root') is just a plain browser DOM call — it searches the currently loaded page only. It's the bundler's job to wire up which JS file goes with which HTML file.
*/