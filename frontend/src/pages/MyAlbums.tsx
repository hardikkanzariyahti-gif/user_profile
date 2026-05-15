import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Album as AlbumIcon, Image as ImageIcon, Plus, Share2, Trash2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAlbums, deleteAlbum } from '../services/albumService';

interface UserProfile {
  id: number;
  name: string;
}

interface MyAlbumsProps {
  loggedInUser: UserProfile | null;
}

const Albums: React.FC<MyAlbumsProps> = ({ loggedInUser }) => {
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<'my' | 'community'>('my');

  const loggedInUserId = loggedInUser ? Number(loggedInUser.id) : null;

  useEffect(() => {
    loadAlbums();
  }, [loggedInUserId]);

  const loadAlbums = async () => {
    setLoading(true);
    try {
      // fetchAlbums returns both for the user and global ones now
      const data = await fetchAlbums(loggedInUserId || 0);
      setAlbums(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredAlbums = albums.filter(album => {
    if (viewMode === 'my') return album.userId === loggedInUserId;
    return album.isGlobal === true;
  });

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation to detail page
    e.stopPropagation();
    
    if (!loggedInUserId || !window.confirm('Are you sure you want to delete this album?')) return;

    try {
      await deleteAlbum(id, loggedInUserId);
      setAlbums(prev => prev.filter(a => a.id !== id));
      setMessage({ type: 'success', text: 'Album deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (!loggedInUser) {
    return (
      <div className="card shadow-lg p-10 text-center" style={{ marginTop: '4rem' }}>
        <h2 className="card-title" style={{ justifyContent: 'center' }}>Please Login</h2>
        <p className="text-muted">You must be logged in to view your private albums.</p>
        <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem', textDecoration: 'none' }}>Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="gallery-container">
      <div className="gallery-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1.5rem',
        marginBottom: '2.5rem' 
      }}>
        <div className="gallery-title-area">
          <h1 className="gallery-title">Albums</h1>
          <p className="gallery-subtitle">Curated collections of shared and personal moments.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="toggle-group" style={{ 
                display: 'flex', 
                background: 'rgba(255,255,255,0.05)', 
                padding: '4px', 
                borderRadius: '12px' 
            }}>
                <button 
                  onClick={() => setViewMode('my')}
                  style={{ 
                    padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', 
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    background: viewMode === 'my' ? 'white' : 'transparent',
                    color: viewMode === 'my' ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                >
                  My Private
                </button>
                <button 
                  onClick={() => setViewMode('community')}
                  style={{ 
                    padding: '0.5rem 1rem', borderRadius: '10px', border: 'none', 
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    background: viewMode === 'community' ? 'white' : 'transparent',
                    color: viewMode === 'community' ? 'var(--primary)' : 'var(--text-muted)'
                  }}
                >
                  Global Community
                </button>
            </div>
            <Link to="/gallery" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                <Plus size={18} /> New Album
            </Link>
        </div>
      </div>

      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '2rem 1.5rem',
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="skeleton-card" style={{ opacity: 0.5 }}>
              <div style={{ 
                aspectRatio: '4/3', 
                borderRadius: '16px', 
                background: 'var(--bg-card)', 
                marginBottom: '1rem',
                animation: 'pulse 1.5s infinite' 
              }} />
              <div style={{ height: '1rem', width: '60%', background: 'var(--bg-card)', borderRadius: '4px', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: '0.75rem', width: '40%', background: 'var(--bg-card)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            </div>
          ))}
          <style>{`
            @keyframes pulse {
              0% { opacity: 0.4; }
              50% { opacity: 0.7; }
              100% { opacity: 0.4; }
            }
          `}</style>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="card shadow-lg p-20 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)' }}>
          <AlbumIcon size={64} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '1.5rem' }} />
          <h2 style={{ color: 'white' }}>No {viewMode === 'my' ? 'Private' : 'Community'} Albums</h2>
          <p className="text-muted">
            {viewMode === 'my' 
              ? 'Create your first album by selecting photos in the gallery.' 
              : 'Publicly shared albums from the community will appear here.'}
          </p>
          <Link to="/gallery" className="btn btn-outline" style={{ display: 'inline-block', marginTop: '1.5rem', textDecoration: 'none' }}>
            Go to Gallery
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '2rem 1.5rem',
        }}>
          <AnimatePresence>
            {filteredAlbums.map((album, idx) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                transition={{ delay: idx * 0.04 }}
                style={{ cursor: 'pointer' }}
              >
                <Link 
                  to={`/albums/${album.id}`} 
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  className="album-link-card"
                >
                  {/* 🖼️ The Iconic Thumbnail Wrapper (4:3 Aspect) */}
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '4 / 3', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    position: 'relative',
                    boxShadow: '0 10px 25px -10px rgba(0,0,0,0.15), 0 4px 6px -4px rgba(0,0,0,0.1)',
                    background: 'var(--bg-card)',
                    marginBottom: '1rem',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    {album.items && album.items.length > 0 ? (
                      <img 
                        src={album.items[0].thumbnailUrl || album.items[0].url} 
                        alt={album.title} 
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                        className="album-cover-img"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
                        <ImageIcon size={36} style={{ opacity: 0.2 }} />
                      </div>
                    )}

                    {/* Subtle gradient bottom overlay for counts if desired, or keep clean */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 40%)',
                      opacity: 0, transition: 'opacity 0.2s'
                    }} className="album-hover-overlay" />
                  </div>
                  
                  {/* ✍️ Content Stack (Below Image) */}
                  <div style={{ padding: '0 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <h3 style={{ 
                        margin: '0 0 4px 0', 
                        fontSize: '1rem', 
                        fontWeight: 700, 
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {album.title}
                      </h3>
                      
                      {album.userId === loggedInUserId && (
                        <button 
                          onClick={(e) => handleDelete(album.id, e)}
                          style={{ 
                            color: 'rgba(239, 68, 68, 0.6)', 
                            background: 'transparent', 
                            border: 'none', 
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'; e.currentTarget.style.background = 'transparent'; }}
                          title="Delete Album"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      color: 'var(--text-muted)', 
                      fontSize: '0.8rem',
                      fontWeight: 500 
                    }}>
                      <span>{album.items?.length || 0} items</span>
                      <span style={{ opacity: 0.4 }}>•</span>
                      <span>{new Date(album.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>

                    {viewMode === 'community' && album.user && (
                      <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                          {album.user.name?.[0] || '?'}
                        </div>
                        {album.user.name}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <style>{`
        .album-link-card:hover .album-cover-img {
          transform: scale(1.06);
        }
        .album-link-card:hover .album-hover-overlay {
          opacity: 1 !important;
        }
      `}</style>

      {message && (
        <div className={`notification ${message.type}`} style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default Albums;
