import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './App.css';

import GrowthTracker from './views/GrowthTracker';
import Category2 from './views/Category2';
import Category3 from './views/Category3';
import Category4 from './views/Category4';
import Category5 from './views/Category5';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <nav className="nav">
          <h1 className="app-title">Orchid Insights</h1>
          <ul className="nav-list">
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/growth-tracker">Orchid Growth Tracker</Link></li>
            <li><Link to="/category2">Category 2</Link></li>
            <li><Link to="/category3">Category 3</Link></li>
            <li><Link to="/category4">Category 4</Link></li>
            <li><Link to="/category5">Category 5</Link></li>
          </ul>
        </nav>

        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/growth-tracker" element={<GrowthTracker />} />
            <Route path="/category2" element={<Category2 />} />
            <Route path="/category3" element={<Category3 />} />
            <Route path="/category4" element={<Category4 />} />
            <Route path="/category5" element={<Category5 />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Dashboard() {
  const cards = [
    { title: 'Orchid Growth Tracker', to: '/growth-tracker', desc: 'Measure & analyze orchid growth' },
    { title: 'Category 2', to: '/category2', desc: 'Placeholder' },
    { title: 'Category 3', to: '/category3', desc: 'Placeholder' },
    { title: 'Category 4', to: '/category4', desc: 'Placeholder' },
    { title: 'Category 5', to: '/category5', desc: 'Placeholder' },
  ];

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="cards">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="card">
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default App;
