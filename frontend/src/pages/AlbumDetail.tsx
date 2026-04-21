import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Share2, Calendar, Trash2, X, Edit2, Save, 
  Plus, MoreVertical, Image as ImageIcon, CheckCircle2,
  AlertCircle, Grid, List, MapPin, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAlbumById, deleteAlbum, editAlbum } from '../services/albumService';
import { fetchGallery } from '../services/galleryService';

interface UserProfile {
  id: number;
  name?: string;
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
  
  // Photo management state
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<number[]>([]);
  const [isRemovingMode, setIsRemovingMode] = useState(false);
  const [itemIdsToRemove, setItemIdsToRemove] = useState<number[]>([]);

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

  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !loggedInUserId || !editForm.title.trim()) return;
    
    setSaving(true);
    try {
      // Calculate final item IDs: current album items + new selections - removals
      const currentItemIds = album.items.map((item: any) => item.id);
      let newItemIds = [...currentItemIds];
      
      if (itemIdsToRemove.length > 0) {
        newItemIds = newItemIds.filter(id => !itemIdsToRemove.includes(id));
      }
      
      if (selectedGalleryIds.length > 0) {
        // Add only those not already present
        const toAdd = selectedGalleryIds.filter(id => !newItemIds.includes(id));
        newItemIds = [...newItemIds, ...toAdd];
      }

      const updated = await editAlbum(Number(id), loggedInUserId, {
        ...editForm,
        itemIds: newItemIds
      });
      
      setAlbum({ ...album, ...updated });
      setIsEditing(false);
      setIsRemovingMode(false);
      setShowAddPhotos(false);
      setItemIdsToRemove([]);
      setSelectedGalleryIds([]);
      setMessage({ type: 'success', text: 'Album updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openAddPhotosModal = async () => {
    setShowAddPhotos(true);
    setLoadingGallery(true);
    try {
      const data = await fetchGallery(); // Fetch global gallery for selection
      setGalleryImages(data.filter((img: any) => !img.isProfile));
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load gallery' });
    } finally {
      setLoadingGallery(false);
    }
  };

  const toggleGallerySelection = (id: number) => {
    setSelectedGalleryIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleRemoval = (id: number) => {
    setItemIdsToRemove(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1rem' }}>
      <div className="loading-spinner" style={{ width: '50px', height: '50px', borderTopColor: 'var(--primary)' }} />
      <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Gathering your memories...</p>
    </div>
  );

  if (!album) return (
    <div className="text-center p-20">
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '3rem', borderRadius: '24px', maxWidth: '400px', margin: '0 auto' }}>
        <ImageIcon size={64} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '1.5rem' }} />
        <h1>Album not found</h1>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>This album might have been deleted or the link is incorrect.</p>
        <Link to="/albums" className="btn btn-primary">Back to My Albums</Link>
      </div>
    </div>
  );

  const coverImage = album.items && album.items.length > 0 ? album.items[0].url : null;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '5rem' }}>
      {/* Hero Section */}
      <div style={{ position: 'relative', height: '60vh', width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginTop: '-2rem', overflow: 'hidden' }}>
        {coverImage ? (
          <motion.img 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1 }}
            src={coverImage} 
            alt="Hero cover" 
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.6)' }} 
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1e2f 0%, #111 100%)' }} />
        )}
        
        <div style={{ 
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4rem 5%', 
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <Link to="/albums" className="nav-link" style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'max-content', 
              marginBottom: '1.5rem', background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', 
              borderRadius: '999px', backdropFilter: 'blur(10px)', color: 'white', textDecoration: 'none',
              fontSize: '0.9rem', fontWeight: 600
            }}>
              <ChevronLeft size={18} /> Back to My Albums
            </Link>
            
            {isEditing ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '600px' }}>
                <input 
                  type="text" value={editForm.title} 
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  style={{ 
                    width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                    color: 'white', padding: '1rem', borderRadius: '12px', fontSize: '2.5rem', fontWeight: 800,
                    outline: 'none', marginBottom: '1rem', backdropFilter: 'blur(10px)'
                  }}
                  autoFocus
                />
                <textarea 
                  value={editForm.description} 
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Tell the story of this album..."
                  style={{ 
                    width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                    color: 'white', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem',
                    minHeight: '100px', backdropFilter: 'blur(10px)', outline: 'none'
                  }}
                />
              </motion.div>
            ) : (
              <div>
                <motion.h1 
                  layoutId="album-title"
                  className="gallery-title" 
                  style={{ marginBottom: '1rem', fontSize: '4rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'white' }}
                >
                  {album.title}
                </motion.h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', color: 'rgba(255,255,255,0.8)', fontSize: '1rem', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={18} /> {new Date(album.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ImageIcon size={18} /> {album.items.length} {album.items.length === 1 ? 'Memorable Photo' : 'Shared Moments'}</div>
                  {album.user && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>{album.user.name?.[0]}</div> By {album.user.name}</div>}
                </div>
                {album.description && <p style={{ marginTop: '1.5rem', color: 'rgba(255,255,255,0.7)', maxWidth: '700px', fontSize: '1.1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{album.description}</p>}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {isEditing ? (
              <>
                <button onClick={() => handleEditSubmit()} disabled={saving} className="btn btn-primary" style={{ padding: '0.8rem 2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.4)' }}>
                  <Save size={20} /> {saving ? 'Saving...' : 'Save Design'}
                </button>
                <button onClick={() => { setIsEditing(false); setIsRemovingMode(false); setItemIdsToRemove([]); }} className="btn btn-outline" style={{ padding: '0.8rem 2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
              </>
            ) : (
              album.userId === loggedInUserId && (
                <>
                  <button onClick={() => setIsEditing(true)} className="btn btn-primary" style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#111', fontWeight: 700 }}>
                    <Edit2 size={20} /> Customize
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button onClick={handleShare} className="btn btn-outline" style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Share2 size={20} />
                    </button>
                  </div>
                  <button onClick={handleDelete} className="btn btn-outline-danger" style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
                    <Trash2 size={20} />
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </div>

      <div className="gallery-container" style={{ paddingTop: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Collection</h2>
            <p className="text-muted">A curated look into {album.title}</p>
          </div>
          
          {isEditing && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={openAddPhotosModal} 
                className="btn btn-outline" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderStyle: 'dashed', borderColor: 'var(--primary)', color: 'var(--primary)' }}
              >
                <Plus size={18} /> Add Photos
              </button>
              <button 
                onClick={() => setIsRemovingMode(!isRemovingMode)} 
                className={`btn ${isRemovingMode ? 'btn-danger' : 'btn-outline-danger'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isRemovingMode ? 'Cancel Removal' : 'Remove Photos'}
              </button>
            </div>
          )}
        </div>

        {album.items.length === 0 ? (
          <div style={{ padding: '5rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '2px dashed rgba(255,255,255,0.05)' }}>
            <ImageIcon size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
            <h3 style={{ opacity: 0.5 }}>Empty Collection</h3>
            {isEditing && <p className="text-muted">Start by adding some photos to this album.</p>}
          </div>
        ) : (
          <div className="gallery-grid" style={{ gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            <AnimatePresence>
              {album.items.map((item: any) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={isRemovingMode ? {} : { y: -10, transition: { duration: 0.3 } }}
                  className="gallery-card"
                  style={{ 
                    position: 'relative', cursor: isRemovingMode ? 'pointer' : 'pointer', 
                    borderRadius: '20px', overflow: 'hidden', height: '350px',
                    border: itemIdsToRemove.includes(item.id) ? '4px solid #ff4444' : 'none',
                    opacity: itemIdsToRemove.includes(item.id) ? 0.6 : 1
                  }}
                  onClick={() => isRemovingMode ? toggleRemoval(item.id) : setSelectedImage(item)}
                >
                  <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  
                  {isRemovingMode && (
                    <div style={{ 
                      position: 'absolute', top: '1rem', right: '1rem', 
                      background: itemIdsToRemove.includes(item.id) ? '#ff4444' : 'rgba(0,0,0,0.5)', 
                      borderRadius: '50%', color: 'white', padding: '5px', zIndex: 10
                    }}>
                      <X size={20} />
                    </div>
                  )}

                  {!isRemovingMode && !isEditing && (
                    <div style={{ 
                      position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                      display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', opacity: 0,
                    }} className="card-hover-overlay">
                       <Plus size={20} color="white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Photo Selection Modal */}
      <AnimatePresence>
        {showAddPhotos && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.95)', zIndex: 5000, display: 'flex', alignItems: 'center', 
            justifyContent: 'center', backdropFilter: 'blur(10px)'
          }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ 
                width: '90vw', maxWidth: '1200px', height: '85vh', background: 'var(--bg-card)', 
                borderRadius: '32px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 50px 100px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ padding: '2rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Add New Memories</h2>
                  <p className="text-muted" style={{ margin: 0 }}>Discover and select photos from your entire collection</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => setShowAddPhotos(false)} 
                    className="btn btn-outline"
                    style={{ borderRadius: '12px' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleEditSubmit()} 
                    disabled={saving || selectedGalleryIds.length === 0}
                    className="btn btn-primary"
                    style={{ borderRadius: '12px', padding: '0.8rem 2rem' }}
                  >
                    Add {selectedGalleryIds.length} Selected
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '3rem' }} className="custom-scrollbar">
                {loadingGallery ? (
                   <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><div className="loading-spinner" /></div>
                ) : (
                  <div className="gallery-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    {galleryImages.map((img: any) => (
                      <div 
                        key={img.id} 
                        onClick={() => toggleGallerySelection(img.id)}
                        style={{ 
                          position: 'relative', aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                          border: selectedGalleryIds.includes(img.id) ? '4px solid var(--primary)' : '2px solid transparent',
                          transform: selectedGalleryIds.includes(img.id) ? 'scale(1.02)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ 
                          position: 'absolute', top: '0.75rem', right: '0.75rem', 
                          background: selectedGalleryIds.includes(img.id) ? 'var(--primary)' : 'rgba(255,255,255,0.2)',
                          width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(4px)', border: '2px solid white'
                        }}>
                          {selectedGalleryIds.includes(img.id) && <CheckCircle2 size={20} color="white" />}
                        </div>
                        {album.items.some((ai: any) => ai.id === img.id) && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', padding: '5px', textAlign: 'center', fontWeight: 600 }}>ALREADY IN ALBUM</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ 
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
              background: 'rgba(0,0,0,0.98)', zIndex: 6000, display: 'flex', 
              alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)' 
            }}
            onClick={() => setSelectedImage(null)}
          >
            <button 
              onClick={() => setSelectedImage(null)} 
              style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'white', padding: '12px', border: 'none', color: '#111', borderRadius: '50%', cursor: 'pointer', zIndex: 6001 }}
            >
              <X size={32} />
            </button>
            <div style={{ 
              position: 'absolute', top: '2rem', left: '2rem', color: 'white', 
              background: 'rgba(255,255,255,0.1)', padding: '15px 25px', borderRadius: '20px', 
              backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' 
            }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{album.title}</h2>
              <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>{album.items.findIndex((i: any) => i.id === selectedImage.id) + 1} / {album.items.length} Memories</p>
            </div>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={selectedImage.url} 
              alt="Full Preview" 
              style={{ maxWidth: '95vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 50px 100px rgba(0,0,0,0.5)' }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className={`notification ${message.type}`} 
          style={{ 
            position: 'fixed', bottom: '3rem', left: '50%', transform: 'translateX(-50%)', 
            zIndex: 9999, minWidth: '300px', display: 'flex', alignItems: 'center', 
            gap: '1rem', padding: '1.25rem 2.5rem', borderRadius: '20px', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            backgroundColor: message.type === 'error' ? '#ff4444' : '#10b981',
            color: 'white', fontWeight: 600
          }}
        >
          {message.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          {message.text}
        </motion.div>
      )}
      
      <style>{`
        .nav-link:hover {
          background: rgba(255,255,255,0.2) !important;
          transform: translateY(-2px);
        }
        .gallery-card:hover .card-hover-overlay {
          opacity: 1 !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
};

export default AlbumDetail;
