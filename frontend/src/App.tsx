import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { UserCircle, MapPin, AppWindow, Loader2, CheckCircle2, X, Image as ImageIcon, Album, Users, Plus, ChevronDown, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadGallery, fetchImageStatus } from './services/galleryService';
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

const Navigation: React.FC<NavigationProps> = () => {
  const location = useLocation();
  return (
    <nav className="nav-links">
      <Link to="/gallery" className={`nav-link ${location.pathname === '/gallery' ? 'active' : ''}`}>
        <ImageIcon size={15} />
        <span>Gallery</span>
      </Link>
      <Link to="/albums" className={`nav-link ${location.pathname.startsWith('/albums') ? 'active' : ''}`}>
        <Album size={15} />
        <span>Albums</span>
      </Link>
      <Link to="/people" className={`nav-link ${location.pathname === '/people' ? 'active' : ''}`}>
        <Users size={15} />
        <span>People</span>
      </Link>
      <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
        <UserCircle size={15} />
        <span>Profiles</span>
      </Link>
    </nav>
  );
};

interface HeaderActionsProps {
  loggedInUser: UserProfile | null;
  handleLogout: () => void;
}

const HeaderActions: React.FC<HeaderActionsProps> = ({ loggedInUser, handleLogout }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleAction = (action: 'upload' | 'camera') => {
    setDropdownOpen(false);
    navigate(`/gallery?action=${action}`);
  };

  return (
    <div className="auth-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
      {/* Combined Action Button [+ Add Photos ▼] */}
      <div ref={dropdownRef} className="dropdown-container" style={{ position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="btn btn-primary"
          style={{
            height: '42px',
            borderRadius: '99px',
            padding: '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          <Plus size={16} />
          <span>Add Photos</span>
          <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </button>

        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '180px',
                background: 'white',
                borderRadius: '16px',
                padding: '0.5rem',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
                zIndex: 9999,
              }}
            >
              <button
                onClick={() => handleAction('upload')}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Plus size={15} style={{ color: 'var(--primary)' }} />
                Upload Photos
              </button>
              <button
                onClick={() => handleAction('camera')}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Camera size={15} style={{ color: 'var(--primary)' }} />
                Capture Photo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loggedInUser ? (
        <>
          <div className="user-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '0.25rem' }}>
            <span className="user-name-nav">{loggedInUser.name}</span>
            <span className="user-status-nav">Verified User</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{
              height: '42px',
              borderRadius: '99px',
              padding: '0 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Logout
          </button>
        </>
      ) : (
        <Link
          to="/login"
          className="btn btn-outline"
          style={{
            height: '42px',
            borderRadius: '99px',
            padding: '0 1.5rem',
            border: '2px solid var(--primary)',
            color: 'var(--primary)',
            background: 'transparent',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
            boxShadow: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Login
        </Link>
      )}
    </div>
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

  // --- Elevated Background Ingest Subsystem ---
  const [bgUpload, setBgUpload] = useState<{
    phase: 'uploading' | 'scanning' | 'metadata' | 'complete';
    count: number;
    total: number;
    percent: number;
    eventName?: string;
    albumId?: number | null;
  } | null>(null);

  const [bgWidgetMinimized, setBgWidgetMinimized] = useState(false);

  const startBackgroundUpload = useCallback(async (
    files: File[], 
    eventConfig?: { name?: string; location?: string; date?: string; desc?: string; eventId?: number; tags?: string[] }
  ) => {
    setBgUpload({
      phase: 'uploading',
      count: 0,
      total: files.length,
      percent: 10,
      eventName: eventConfig?.name
    });
    setBgWidgetMinimized(false);

    const formData = new FormData();
    files.forEach(f => formData.append('gallery', f));

    if (eventConfig && (eventConfig.name || eventConfig.eventId || eventConfig.tags)) {
      formData.append('isEventUpload', 'true');
      if (eventConfig.name) formData.append('eventName', eventConfig.name);
      if (eventConfig.location) formData.append('eventLocation', eventConfig.location);
      if (eventConfig.date) formData.append('eventDate', eventConfig.date);
      if (eventConfig.desc) formData.append('eventDescription', eventConfig.desc);
      if (eventConfig.eventId) formData.append('eventId', String(eventConfig.eventId));
      if (eventConfig.tags) formData.append('tags', eventConfig.tags.join(','));
    }

    const uploaderId = loggedInUser ? Number(loggedInUser.originalId ?? loggedInUser.id) : undefined;

    try {
      const result = await uploadGallery(formData, uploaderId);
      
      let uploadedItemIds: number[] = [];
      let albumId: number | null = null;

      if (result && result.gallery) {
        uploadedItemIds = result.uploadedItemIds || [];
        albumId = result.albumId;
      }

      if (uploadedItemIds.length === 0) {
        setBgUpload({
          phase: 'complete',
          count: files.length,
          total: files.length,
          percent: 100,
          eventName: eventConfig?.name,
          albumId
        });
        return result;
      }

      setBgUpload({
        phase: 'scanning',
        count: 0,
        total: uploadedItemIds.length,
        percent: 35,
        eventName: eventConfig?.name,
        albumId
      });

      const poll = async () => {
        try {
          const statuses = await Promise.all(
            uploadedItemIds.map(id => fetchImageStatus(id).catch(() => null))
          );
          const valid = statuses.filter(Boolean);
          const total = uploadedItemIds.length;

          const scanDone = valid.filter((s: any) => s.scanStatus === 'completed' || s.scanStatus === 'failed').length;
          const metaDone = valid.filter((s: any) => s.metadataStatus === 'completed' || s.metadataStatus === 'failed').length;

          if (scanDone < total) {
            const pct = 35 + Math.round((scanDone / total) * 30);
            setBgUpload({ phase: 'scanning', count: scanDone, total, percent: pct, eventName: eventConfig?.name, albumId });
            setTimeout(poll, 2000);
          } else if (metaDone < total) {
            const pct = 65 + Math.round((metaDone / total) * 30);
            setBgUpload({ phase: 'metadata', count: metaDone, total, percent: pct, eventName: eventConfig?.name, albumId });
            setTimeout(poll, 2000);
          } else {
            setBgUpload({ phase: 'complete', count: total, total, percent: 100, eventName: eventConfig?.name, albumId });
            window.dispatchEvent(new CustomEvent('bg-upload-complete', { detail: { albumId } }));
          }
        } catch (e) {
          console.error('[BG Poll Engine] failed loop frame:', e);
          setTimeout(poll, 3000);
        }
      };

      setTimeout(poll, 2000);
      return result;

    } catch (err: any) {
      console.error('[Background Ingest] Error failed stream:', err);
      setBgUpload(null);
      throw err;
    }
  }, [loggedInUser]);

  return (
    <BrowserRouter>
      <main className="app-container">
        <header className="header">
          <div className="header-container">
            <div className="nav-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <Navigation loggedInUser={loggedInUser} />
              <MiniSearchBar />
              <HeaderActions loggedInUser={loggedInUser} handleLogout={handleLogout} />
            </div>
          </div>
        </header>


        <Routes>
          <Route path="/" element={<UserList onLogin={handleLogin} loggedInUser={loggedInUser} />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/create" element={<ProfileForm mode="create" />} />
          <Route path="/update/:id" element={<ProfileForm mode="update" />} />
          <Route path="/gallery" element={<Gallery loggedInUser={loggedInUser} startBackgroundUpload={startBackgroundUpload} />} />
          <Route path="/people" element={<People />} />
          <Route path="/search" element={<Search />} />
          <Route path="/tags/:tag" element={<TagResults />} />
          <Route path="/albums" element={<Albums loggedInUser={loggedInUser} />} />
          <Route path="/albums/:id" element={<AlbumDetail loggedInUser={loggedInUser} />} />
          <Route path="/s/:shareId" element={<SharedAlbum />} />
        </Routes>

        {/* FLOATING BACKGROUND PROGRESS PANEL */}
        <AnimatePresence>
          {bgUpload && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              style={{
                position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
                width: '350px', 
                background: 'rgba(30, 41, 59, 0.94)', backdropFilter: 'blur(16px)',
                borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.3)',
                color: 'white', overflow: 'hidden'
              }}
            >
              <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {bgUpload.phase === 'complete' ? (
                    <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                  ) : (
                    <Loader2 size={18} className="spin" style={{ color: 'var(--primary)' }} />
                  )}
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {bgUpload.eventName ? `EVENT: ${bgUpload.eventName}` : 'INGESTING ASSETS'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setBgWidgetMinimized(!bgWidgetMinimized)}
                    style={{ background: 'transparent', border: 'none', padding: '4px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
                  >
                    {bgWidgetMinimized ? '+' : '−'}
                  </button>
                  {bgUpload.phase === 'complete' && (
                    <button 
                      onClick={() => setBgUpload(null)}
                      style={{ background: 'transparent', border: 'none', padding: '4px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {!bgWidgetMinimized && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ padding: '1.25rem', overflow: 'hidden' }}
                  >
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {bgUpload.phase === 'uploading' && 'Streaming Binary Assets...'}
                        {bgUpload.phase === 'scanning' && 'Face Matrices Decoding...'}
                        {bgUpload.phase === 'metadata' && 'Visual Analytics Profiling...'}
                        {bgUpload.phase === 'complete' && 'Fully Mapped! All assets live.'}
                      </span>
                      <span style={{ opacity: 0.6 }}>{bgUpload.percent}%</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                      <div style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center', border: bgUpload.phase === 'uploading' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.04)' }}>
                        UP: {bgUpload.phase === 'uploading' ? 'Run' : 'Done'}
                      </div>
                      <div style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center', border: bgUpload.phase === 'scanning' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.04)' }}>
                        SCAN: {bgUpload.phase === 'scanning' ? `${bgUpload.count}/${bgUpload.total}` : bgUpload.phase === 'uploading' ? 'Wait' : 'Done'}
                      </div>
                      <div style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', textAlign: 'center', border: bgUpload.phase === 'metadata' ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.04)' }}>
                        META: {bgUpload.phase === 'metadata' ? `${bgUpload.count}/${bgUpload.total}` : bgUpload.phase === 'complete' ? 'Done' : 'Wait'}
                      </div>
                    </div>

                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                      <motion.div 
                        animate={{ width: `${bgUpload.percent}%` }}
                        transition={{ duration: 0.3 }}
                        style={{
                          height: '100%', borderRadius: '99px',
                          background: bgUpload.phase === 'complete' ? '#10b981' : 'linear-gradient(90deg, #818cf8, #c084fc, #f472b6)'
                        }}
                      />
                    </div>

                    {bgUpload.albumId && (
                      <Link 
                        to={`/albums/${bgUpload.albumId}`}
                        style={{ 
                          display: 'block', marginTop: '1.25rem', textAlign: 'center', 
                          background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)',
                          padding: '8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 800,
                          textDecoration: 'none', transition: 'all 0.2s'
                        }}
                      >
                        View Event Collection →
                      </Link>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spin {
            animation: spin 1s linear infinite;
          }
        `}</style>

        <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &copy; 2026 ProProfile Inc.
        </footer>
      </main>
    </BrowserRouter>
  );
}

export default App;
