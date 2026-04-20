import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Calendar, Trash2, ExternalLink, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAlbumById, deleteAlbum, editAlbum } from '../services/albumService';
import { Edit2, Save, X as XIcon } from 'lucide-react';

interface UserProfile {
  id: number;
}

interface AlbumDetailProps {
  loggedInUser: UserProfile | null;
}

const AlbumDetail: React.FC<AlbumDetailProps> = ({ loggedInUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loggedInUserId = loggedInUser ? Number(loggedInUser.id) : null;

  useEffect(() => {
    if (id && loggedInUserId) {
      loadAlbum(Number(id), loggedInUserId);
    }
  }, [id, loggedInUserId]);

  const loadAlbum = async (albumId: number, uId: number) => {
    setLoading(true);
    try {
      const data = await fetchAlbumById(albumId, uId);
      setAlbum(data);
      setEditForm({ title: data.title, description: data.description || '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!album) return;
    const shareUrl = `${window.location.origin}/s/${album.shareId}`;
    navigator.clipboard.writeText(shareUrl);
    setMessage({ type: 'success', text: 'Shareable link copied to clipboard!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async () => {
    if (!id || !loggedInUserId || !window.confirm('Delete this album permanently?')) return;
    try {
      await deleteAlbum(Number(id), loggedInUserId);
      navigate('/albums');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !loggedInUserId || !editForm.title.trim()) return;
    
    setSaving(true);
    try {
      const updated = await editAlbum(Number(id), loggedInUserId, editForm);
      setAlbum({ ...album, ...updated });
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Album updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '10rem' }}><div className="loading-spinner" /></div>;
  if (!album) return <div className="text-center p-20"><h1>Album not found</h1><Link to="/albums" className="btn btn-primary">Back to Albums</Link></div>;

  return (
    <div className="gallery-container">
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/albums" className="nav-link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'max-content', marginBottom: '1rem' }}>
          <ChevronLeft size={20} /> Back to My Albums
        </Link>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          {!isEditing ? (
            <div style={{ flex: 1 }}>
              <h1 className="gallery-title" style={{ marginBottom: '0.5rem' }}>{album.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={16} /> Created {new Date(album.createdAt).toLocaleDateString()}</div>
                <div>{album.items.length} {album.items.length === 1 ? 'Photo' : 'Photos'}</div>
              </div>
              {album.description && <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.7)', maxWidth: '600px', whiteSpace: 'pre-wrap' }}>{album.description}</p>}
            </div>
          ) : (
            <form onSubmit={handleEditSubmit} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Album Title</label>
                <input 
                  type="text" value={editForm.title} 
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  style={{ width: '100%', background: '#111', border: '1px solid #333', color: 'white', padding: '10px', borderRadius: '8px' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Description</label>
                <textarea 
                  value={editForm.description} 
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ width: '100%', background: '#111', border: '1px solid #333', color: 'white', padding: '10px', borderRadius: '8px', minHeight: '100px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          )}
          
          {!isEditing && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setIsEditing(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} /> Edit
              </button>
              <button onClick={handleShare} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={18} /> Share
              </button>
              <button onClick={handleDelete} className="btn btn-outline-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="gallery-grid">
        {album.items.map((item: any) => (
          <motion.div
            key={item.id}
            whileHover={{ scale: 1.02 }}
            className="gallery-card"
            style={{ position: 'relative', cursor: 'pointer', aspectRatio: '1/1' }}
            onClick={() => setSelectedImage(item)}
          >
            <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }} />
          </motion.div>
        ))}
      </div>

      {/* Basic Modal for Preview */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setSelectedImage(null)}
          >
            <button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><XIcon size={40} /></button>
            <div style={{ position: 'absolute', top: '2rem', left: '2rem', color: 'white', background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '12px', backdropFilter: 'blur(4px)' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.05rem' }}>{album.title}</h2>
              <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>{album.items.indexOf(selectedImage) + 1} / {album.items.length} Photos</p>
            </div>
            <img src={selectedImage.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <div className={`notification ${message.type}`} style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999 }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default AlbumDetail;
