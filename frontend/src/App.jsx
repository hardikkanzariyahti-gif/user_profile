import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserCircle, MapPin, AppWindow } from 'lucide-react';
import UserList from './pages/UserList';
import ProfileForm from './pages/ProfileForm';
import Gallery from './pages/Gallery';
import Login from './pages/Login';

const Navigation = () => {
  const location = useLocation();
  return (
    <nav className="nav-links">
      <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
        Check Profiles
      </Link>
      <Link to="/gallery" className={`nav-link ${location.pathname === '/gallery' ? 'active' : ''}`}>
        Gallery
      </Link>
      <Link to="/create" className={`nav-link ${location.pathname === '/create' ? 'active' : ''}`}>
        Get Started
      </Link>
    </nav>
  );
};

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const user = localStorage.getItem('loggedInUser');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        const normalized = {
          ...parsed,
          id: Number(parsed.originalId ?? parsed.id),
        };
        setLoggedInUser(normalized);
      } catch (e) {
        console.error('Error parsing loggedInUser:', e);
        localStorage.removeItem('loggedInUser');
      }
    }
  }, []);

  const handleLogin = (user) => {
    const normalized = {
      ...user,
      id: Number(user.originalId ?? user.id),
    };
    localStorage.setItem('loggedInUser', JSON.stringify(normalized));
    setLoggedInUser(normalized);
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setLoggedInUser(null);
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Navigation />
            <div style={{ marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {loggedInUser ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{loggedInUser.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Verified User</span>
                  </div>
                  <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}>Logout</button>
                </>
              ) : (
                <Link to="/login" className="btn btn-primary" style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem', borderRadius: '8px', textDecoration: 'none' }}>Login</Link>
              )}
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<UserList onLogin={handleLogin} loggedInUser={loggedInUser} />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/create" element={<ProfileForm mode="create" />} />
          <Route path="/update/:id" element={<ProfileForm mode="update" />} />
          <Route path="/gallery" element={<Gallery loggedInUser={loggedInUser} />} />
        </Routes>

        <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &copy; 2026 ProProfile Inc.      </footer>
      </main>
    </BrowserRouter>
  );
}

export default App;
