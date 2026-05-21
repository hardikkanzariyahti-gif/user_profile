import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Album as AlbumIcon, Image as ImageIcon, Plus, Trash2, Search, Calendar, MapPin, Users, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAlbums, deleteAlbum } from '../services/albumService';
import { CustomDropdown } from '../components/CustomDropdown';
import { CreateEventModal } from '../components/CreateEventModal';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const loggedInUserId = loggedInUser ? Number(loggedInUser.id) : null;

  useEffect(() => {
    loadAlbums();
  }, [loggedInUserId]);

  const loadAlbums = async () => {
    setLoading(true);
    try {
      const data = await fetchAlbums(loggedInUserId || 0);
      setAlbums(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const processedAlbums = useMemo(() => {
    let filtered = albums.filter(album => {
      const title = album.title || 'Untitled';
      const type = album.eventType || '';
      const loc = album.location || '';
      return title.toLowerCase().includes(searchTerm.toLowerCase()) ||
             type.toLowerCase().includes(searchTerm.toLowerCase()) ||
             loc.toLowerCase().includes(searchTerm.toLowerCase());
    });

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered;
  }, [albums, searchTerm]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    try {
      await deleteAlbum(id, loggedInUserId || 0);
      setAlbums(prev => prev.filter(a => a.id !== id));
      setMessage({ type: 'success', text: 'Event deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateSuccess = (newAlbum: any) => {
    setIsCreateModalOpen(false);
    loadAlbums();
    navigate(`/albums/${newAlbum.id}`);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem 5rem', minHeight: '80vh', background: '#f8fafc' }}>
      
      {/* Page Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem',
        paddingTop: '2.5rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 className="page-heading">
            Events / Albums
          </h2>
          <p className="page-subtitle">
            Organize and navigate your memories, tours, and photo collections.
          </p>
        </div>
        
        {/* Navigation Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', opacity: 0.7 }} />
            <input 
              placeholder="Search events or categories..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', height: '42px', padding: '0 1.25rem 0 2.75rem', borderRadius: '99px',
                background: '#ffffff', border: '1px solid #cbd5e1',
                color: '#0f172a', outline: 'none', fontSize: '0.9rem', fontWeight: 600,
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            />
          </div>

          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={16} /> New Event
          </button>
        </div>
      </div>

      {/* Layout Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: '1.5rem',
        }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ opacity: 0.6 }}>
              <div style={{ aspectRatio: '16/10', borderRadius: '16px', background: '#e2e8f0', marginBottom: '0.75rem' }} />
              <div style={{ height: '1.2rem', width: '70%', background: '#e2e8f0', borderRadius: '6px', marginBottom: '0.4rem' }} />
              <div style={{ height: '0.8rem', width: '40%', background: '#e2e8f0', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : processedAlbums.length === 0 ? (
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderRadius: '24px',
          padding: '5rem 2rem',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '3rem auto',
          boxShadow: '0 4px 20px -2px rgba(0,0,0,0.02)'
        }}>
          <AlbumIcon size={48} style={{ color: '#6366f1', opacity: 0.6, marginBottom: '1rem' }} />
          <h3 style={{ color: '#0f172a', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem' }}>No Events Created Yet</h3>
          <p style={{ maxWidth: '380px', margin: '0 auto 1.5rem', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
            {searchTerm ? `We couldn't find any event matching "${searchTerm}".` : 
             "Create your first event to organize trips, tours, and cherished memories."}
          </p>
          {!searchTerm && (
            <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
              <Plus size={16} /> Create Event
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: '1.25rem',
        }}>
          <AnimatePresence>
            {processedAlbums.map((album, idx) => {
              const totalPhotos = album.items?.length || 0;
              
              // Calculate unique people
              const peopleSet = new Set<string>();
              album.items?.forEach((item: any) => {
                if (Array.isArray(item.recognizedUsers)) {
                  item.recognizedUsers.forEach((u: any) => u && u.id && peopleSet.add(String(u.id)));
                } else if (Array.isArray(item.people)) {
                  item.people.forEach((p: any) => p && p.userId && peopleSet.add(String(p.userId)));
                }
              });
              const peopleCount = peopleSet.size;

              const eventDate = album.date || new Date(album.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
              const eventLoc = album.location || 'Various Locations';

              return (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  transition={{ delay: idx * 0.03 }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: '0.85rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Link to={`/albums/${album.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    
                    {/* Cover Box */}
                    <div style={{ 
                      width: '100%', 
                      aspectRatio: '16 / 10', 
                      borderRadius: '14px', 
                      overflow: 'hidden', 
                      position: 'relative',
                      background: '#f1f5f9',
                      marginBottom: '0.75rem',
                      border: '1px solid rgba(0,0,0,0.03)'
                    }}>
                      {album.items && album.items.length > 0 ? (
                        <img 
                          src={album.items[0].thumbnailUrl || album.items[0].url} 
                          alt={album.title} 
                          loading="lazy" 
                          onError={(e) => {
                            const target = e.currentTarget;
                            const full = album.items[0].url;
                            if (target.src !== full && full) {
                              target.src = full;
                            } else if (!target.src.startsWith('http') && full) {
                              target.src = `http://localhost:4001${full}`;
                            }
                          }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} 
                          className="album-cover-v4" 
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <ImageIcon size={28} style={{ color: '#94a3b8' }} />
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>No photos yet</span>
                        </div>
                      )}

                      {/* Top-Left Event/Album Name Cover Badge */}
                      {album.title && (
                        <div style={{ 
                          position: 'absolute', top: 10, left: 10, 
                          padding: '3px 10px', borderRadius: 12, 
                          background: 'rgba(255, 255, 255, 0.9)', 
                          backdropFilter: 'blur(4px)', 
                          color: '#4f46e5', fontSize: '0.7rem', fontWeight: 800, 
                          letterSpacing: '0.3px', 
                          border: '1px solid rgba(0, 0, 0, 0.05)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={album.title}>
                          {album.title}
                        </div>
                      )}
                    </div>

                    {/* Details Block */}
                    <div style={{ padding: '0 2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, letterSpacing: '-0.3px' }}>
                          {album.title || 'Untitled Event'}
                        </h4>
                        
                        <button 
                          onClick={(e) => handleDelete(album.id, e)} 
                          style={{ 
                            color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px',
                            display: 'flex', alignItems: 'center', borderRadius: '50%', transition: 'all 0.15s'
                          }} 
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          title="Delete Event"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      
                      {/* Compact Aligned Metadata */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem' }}>
                        {album.eventType && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            {album.eventType}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} style={{ opacity: 0.8 }} /> {eventDate}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} style={{ opacity: 0.8 }} /> {eventLoc}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(99,102,241,0.06)', color: '#4f46e5', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          {totalPhotos} photos
                        </span>
                        {peopleCount > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={12} style={{ color: '#6366f1' }} /> {peopleCount} people
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        loggedInUserId={loggedInUserId || 0}
      />

      {message && (
        <div className={`notification ${message.type}`} style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default Albums;
