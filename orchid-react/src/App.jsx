import { useEffect, useRef } from 'react';
import './App.css';
import markup from './markup.html?raw';
import { initDashboard } from './dashboard';

function App() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initDashboard();
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: markup }} />;
}

export default App;
