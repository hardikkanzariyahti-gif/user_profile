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

  // 📅 [Hierarchical Chronology] - Same optimized grouping logic from Main Gallery
  const groupedItems = React.useMemo(() => {
    if (!album || !album.items) return [];
    
    const today = new Date();
    const todayStr = today.toLocaleDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();
    
    const groups: Record<string, { title: string; time: number; items: any[] }> = {};
    
    album.items.forEach((img: any) => {
      const ts = img.uploadedAt || img.createdAt || 0;
      const d = ts ? new Date(ts) : new Date();
      
      const key = d.toISOString().split('T')[0];
      const localStr = d.toLocaleDateString();
      
      if (!groups[key]) {
        let title = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        if (localStr === todayStr) title = 'Today';
        else if (localStr === yesterdayStr) title = 'Yesterday';
        else if (d.getFullYear() === today.getFullYear()) {
          title = d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
        } else {
          title = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
        groups[key] = { title, time: d.getTime(), items: [] };
      }
      groups[key].items.push(img);
    });

    return Object.values(groups).sort((a, b) => b.time - a.time);
  }, [album]);

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
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '2rem 1.5rem 5rem',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* 🏛️ Modern Compact Header Array */}
      <div style={{
        background: 'linear-gradient(to right, #1a1a2e, #16213e)',
        borderRadius: '24px',
        padding: '2.5rem',
        marginBottom: '3rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        display: 'flex',
        gap: '2.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        {/* Glass Effect Blur Backdrop */}
        <div style={{
          position: 'absolute', inset: 0,
          background: coverImage ? `url(${coverImage}) center/cover no-repeat` : 'none',
          filter: 'blur(30px) saturate(1.5) brightness(0.4)',
          opacity: coverImage ? 0.3 : 0,
          zIndex: 0
        }} />

        {/* Floating Card Cover Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }}
          style={{ 
            width: '160px', height: '160px', borderRadius: '16px', overflow: 'hidden', 
            boxShadow: '0 15px 30px rgba(0,0,0,0.3)', zIndex: 1, position: 'relative',
            background: '#1e293b', flexShrink: 0, border: '3px solid rgba(255,255,255,0.1)'
          }}>
          {coverImage ? (
            <img src={coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={40} style={{ opacity: 0.3, color: 'white' }} />
            </div>
          )}
        </motion.div>

        {/* Text & Stats Details Column */}
        <div style={{ flex: 1, zIndex: 1, minWidth: '280px' }}>
          <Link to="/albums" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            <ChevronLeft size={16} /> Back to Collection
          </Link>

          {isEditing ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <input 
                type="text" value={editForm.title} 
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                style={{ 
                  width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                  color: 'white', padding: '0.75rem', borderRadius: '10px', fontSize: '1.75rem', fontWeight: 800,
                  outline: 'none', marginBottom: '0.75rem'
                }}
                autoFocus
              />
              <textarea 
                value={editForm.description} 
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe these memories..."
                style={{ 
                  width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', 
                  color: 'white', padding: '0.75rem', borderRadius: '10px', fontSize: '0.95rem',
                  minHeight: '60px', resize: 'none', outline: 'none'
                }}
              />
            </motion.div>
          ) : (
            <>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', margin: '0 0 0.5rem' }}>{album.title}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} /> {new Date(album.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'white' }}><ImageIcon size={16} /> {album.items.length} photos</div>
                {album.user && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>{album.user.name?.[0]}</div>
                  By {album.user.name}
                </div>}
              </div>
              {album.description && <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', maxWidth: '600px', lineHeight: 1.5 }}>{album.description}</p>}
            </>
          )}
        </div>

        {/* Action Buttons Pod */}
        <div style={{ display: 'flex', gap: '0.75rem', zIndex: 1, alignSelf: 'flex-start' }}>
          {isEditing ? (
            <>
              <button onClick={() => handleEditSubmit()} disabled={saving} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setIsEditing(false); setIsRemovingMode(false); setItemIdsToRemove([]); }} className="btn" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', fontSize: '0.9rem' }}>Cancel</button>
            </>
          ) : (
            album.userId === loggedInUserId && (
              <>
                <button onClick={() => setIsEditing(true)} style={{ background: 'white', color: '#0f172a', padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <Edit2 size={16} /> Edit
                </button>
                <button onClick={handleShare} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.6rem', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Share2 size={18} />
                </button>
                <button onClick={handleDelete} style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '0.6rem', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={18} />
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* 🛠️ Toolbar & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Moments Collected</h2>
        
        {isEditing && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={openAddPhotosModal} 
              style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px dashed var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <Plus size={16} /> Add Photos
            </button>
            <button 
              onClick={() => setIsRemovingMode(!isRemovingMode)} 
              style={{ background: isRemovingMode ? '#ef4444' : 'transparent', color: isRemovingMode ? 'white' : '#ef4444', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {isRemovingMode ? 'Exit Removal' : 'Select to Remove'}
            </button>
          </div>
        )}
      </div>

      {/* 📸 Main Organized Photos Stack */}
      {album.items.length === 0 ? (
        <div style={{ padding: '5rem 2rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '16px', border: '2px dashed var(--border-color)' }}>
          <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0' }}>No memories in this album yet</h3>
          {isEditing ? (
            <p className="text-muted">Click "Add Photos" in toolbar above to fill your collection.</p>
          ) : (
            <p className="text-muted">Owner hasn't shared moments here yet.</p>
          )}
        </div>
      ) : (
        <div className="google-photos-flow">
          <AnimatePresence>
            {groupedItems.map((group) => (
              <div key={group.title} className="date-bucket" style={{ marginBottom: '3rem' }}>
                {/* Persistent Date Anchor */}
                <div style={{
                  position: 'sticky',
                  top: '10px', 
                  zIndex: 20,
                  padding: '0.5rem 0',
                  background: 'rgba(var(--bg-main-rgb), 0.8)',
                  backdropFilter: 'blur(10px)',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    {group.title}
                    <span style={{ fontWeight: 400, fontSize: '0.75rem', opacity: 0.5, background: 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: '10px' }}>
                      {group.items.length}
                    </span>
                  </h3>
                </div>

                {/* Optimized Dense Grid Array */}
                <div className="grid-layer" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {group.items.map((item: any) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                      style={{ 
                        position: 'relative', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        aspectRatio: '1 / 1', 
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        border: itemIdsToRemove.includes(item.id) ? '3px solid #ef4444' : 'none',
                        background: '#f1f5f9'
                      }}
                      onClick={() => isRemovingMode ? toggleRemoval(item.id) : setSelectedImage(item)}
                    >
                      <img 
                        src={item.thumbnailUrl || item.url} 
                        alt="" 
                        loading="lazy"
                        style={{ 
                          width: '100%', height: '100%', objectFit: 'cover',
                          opacity: itemIdsToRemove.includes(item.id) ? 0.4 : 1,
                          transition: 'opacity 0.2s'
                        }} 
                      />

                      {/* Removal Selection Logic */}
                      {isRemovingMode && (
                        <div style={{ 
                          position: 'absolute', top: '8px', right: '8px', 
                          background: itemIdsToRemove.includes(item.id) ? '#ef4444' : 'rgba(0,0,0,0.4)', 
                          borderRadius: '50%', color: 'white', width: '24px', height: '24px', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                          backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          {itemIdsToRemove.includes(item.id) ? <CheckCircle2 size={16} /> : <X size={14} />}
                        </div>
                      )}

                      {/* Smooth Interactive Overlayer */}
                      {!isRemovingMode && (
                        <div className="hover-layer" style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity 0.2s', zIndex: 5
                        }}>
                          <div style={{ background: 'white', borderRadius: '20px', padding: '6px 12px', color: 'black', fontSize: '0.7rem', fontWeight: 700, boxShadow: '0 4px 10px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <ImageIcon size={12} /> View
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

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

      {/* Global CSS Extensions */}
      <style>{`
        .grid-layer > div:hover .hover-layer {
          opacity: 1 !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AlbumDetail;
