import { Routes, Route } from 'react-router-dom';
import ChatInterface from './components/ChatInterface';
import AboutData from './components/DataAbout/AboutData'; // adjust path if needed

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatInterface />} />
      <Route path="/about-data" element={<AboutData />} />
    </Routes>
  );
}
export default App;