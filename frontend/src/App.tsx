import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserCircle, MapPin, AppWindow } from 'lucide-react';
import { MiniSearchBar } from './components/MiniSearchBar';
import UserList from './pages/UserList';
import ProfileForm from './pages/ProfileForm';
import Gallery from './pages/Gallery';
import Login from './pages/Login';
import Albums from './pages/MyAlbums';
import AlbumDetail from './pages/AlbumDetail';
import SharedAlbum from './pages/SharedAlbum';
import Search from './pages/Search';
import TagResults from './pages/TagResults';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  originalId?: number;
}

import People from './pages/People';

interface NavigationProps {
  loggedInUser: UserProfile | null;
}

const Navigation: React.FC<NavigationProps> = ({ loggedInUser }) => {
  const location = useLocation();
  return (
    <nav className="nav-links">
      <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
        All Profiles
      </Link>
      <Link to="/gallery" className={`nav-link ${location.pathname === '/gallery' ? 'active' : ''}`}>
        Gallery
      </Link>
      <Link to="/people" className={`nav-link ${location.pathname === '/people' ? 'active' : ''}`}>
        People
      </Link>
      {loggedInUser && (
        <Link to="/albums" className={`nav-link ${location.pathname.startsWith('/albums') ? 'active' : ''}`}>
          Albums
        </Link>
      )}
      <Link to="/create" className={`nav-link ${location.pathname === '/create' ? 'active' : ''}`}>
        Sign In
      </Link>
    </nav>
  );
};

function App() {
  const [loggedInUser, setLoggedInUser] = useState<UserProfile | null>(null);

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

  const handleLogin = (user: UserProfile) => {
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
          <div className="header-container">
            <div className="nav-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <Navigation loggedInUser={loggedInUser} />
              <MiniSearchBar />
              <div className="auth-actions">
                {loggedInUser ? (
                  <>
                    <div className="user-info">
                      <span className="user-name-nav">{loggedInUser.name}</span>
                      <span className="user-status-nav">Verified User</span>
                    </div>
                    <button onClick={handleLogout} className="btn btn-outline btn-sm">Logout</button>
                  </>
                ) : (
                  <Link to="/login" className="btn btn-primary btn-sm login-btn">Login</Link>
                )}
              </div>
            </div>
          </div>
        </header>


        <Routes>
          <Route path="/" element={<UserList onLogin={handleLogin} loggedInUser={loggedInUser} />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/create" element={<ProfileForm mode="create" />} />
          <Route path="/update/:id" element={<ProfileForm mode="update" />} />
          <Route path="/gallery" element={<Gallery loggedInUser={loggedInUser} />} />
          <Route path="/people" element={<People />} />
          <Route path="/search" element={<Search />} />
          <Route path="/tags/:tag" element={<TagResults />} />
          <Route path="/albums" element={<Albums loggedInUser={loggedInUser} />} />
          <Route path="/albums/:id" element={<AlbumDetail loggedInUser={loggedInUser} />} />
          <Route path="/s/:shareId" element={<SharedAlbum />} />
        </Routes>

        <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &copy; 2026 ProProfile Inc.
        </footer>
      </main>
    </BrowserRouter>
  );
}

export default App;
