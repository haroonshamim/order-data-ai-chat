import { Routes, Route } from 'react-router-dom';
import ChatInterface from './components/ChatPage/ChatInterface';
import AboutData from './components/DataAbout/AboutData'; // adjust path if needed
import TestPrintComponent from './components/ForTesting/TestPrintComponent';

function App() {
  return (
    //1.Test Print
       //<h1> I Am Testing </h1>
    //2.Test Interface
       //<TestPrintComponent/>
    //3.Original Interface. I have defined routes. / mean empty. /about-data mean to load AboutData Component. I have also added a button in AboutData component to navigate back to the main page.
      <Routes>
      <Route path="/" element={<ChatInterface/>} />
      <Route path="/about-data" element={<AboutData />} />
    </Routes>
   
      
  );
}
export default App;