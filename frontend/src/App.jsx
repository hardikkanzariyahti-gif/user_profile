import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserCircle, MapPin, AppWindow } from 'lucide-react';
import UserList from './pages/UserList';
import ProfileForm from './pages/ProfileForm';
import Gallery from './pages/Gallery';

const Navigation = () => {
  const location = useLocation();
  return (
    <nav className="nav-links">
      <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
        Check Profiles
      </Link>
      <Link to="/create" className={`nav-link ${location.pathname === '/create' ? 'active' : ''}`}>
        Create New
      </Link>
      <Link to="/gallery" className={`nav-link ${location.pathname === '/gallery' ? 'active' : ''}`}>
        Gallery
      </Link>
    </nav>
  );
};

function App() {
  return (
    <BrowserRouter>
      <main className="app-container">
        <header className="header">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div className="logo">
              <UserCircle size={32} />
              <span>ProProfile</span>
            </div>
          </Link>
          <Navigation />
        </header>

        <Routes>
          <Route path="/" element={<UserList />} />
          <Route path="/create" element={<ProfileForm mode="create" />} />
          <Route path="/update/:id" element={<ProfileForm mode="update" />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>

        <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &copy; 2024 ProProfile Inc. • Designed with Excellence
        </footer>
      </main>
    </BrowserRouter>
  );
}

export default App;
