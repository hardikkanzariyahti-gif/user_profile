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
      <div className="gallery-header" style={{ marginBottom: '3rem' }}>
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="loading-spinner" />
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
        <div className="gallery-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          <AnimatePresence>
            {filteredAlbums.map((album, idx) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="gallery-card"
                style={{ position: 'relative', overflow: 'hidden', height: '380px' }}
              >
                <Link to={`/albums/${album.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                  <div style={{ padding: '1.25rem' }}>
                    <h3 style={{ color: '#1a1a1a', margin: '0 0 0.75rem 0', fontSize: '1.4rem', fontWeight: 800, textTransform: 'capitalize' }}>{album.title}</h3>
                    
                    <div style={{ position: 'relative', height: '240px', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
                      {album.items && album.items[0] ? (
                        <img 
                          src={album.items[0].url} 
                          alt={album.title} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      ) : (
                          <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ImageIcon size={48} style={{ opacity: 0.2 }} />
                          </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                <Calendar size={14} />
                                {new Date(album.createdAt).toLocaleDateString()}
                            </div>
                            {viewMode === 'community' && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>By {album.user?.name}</span>
                            )}
                        </div>
                        {album.userId === loggedInUserId && (
                            <button 
                                onClick={(e) => handleDelete(album.id, e)}
                                className="btn-icon" 
                                style={{ color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {message && (
        <div className={`notification ${message.type}`} style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default Albums;
