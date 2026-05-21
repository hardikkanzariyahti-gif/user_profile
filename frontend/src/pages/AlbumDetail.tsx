import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Share2, Calendar, Trash2, X, Edit2, Save, 
  Plus, ImageIcon, CheckCircle2,
  AlertCircle, MapPin, Camera, Sparkles, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAlbumById, deleteAlbum, editAlbum } from '../services/albumService';
import { fetchGallery, uploadGallery } from '../services/galleryService';
import { ImageDetailModal } from '../components/ImageDetailModal';
import CameraCapture from '../components/CameraCapture';

interface UserProfile {
  id: number;
  name?: string;
}

interface AlbumDetailProps {
  loggedInUser: UserProfile | null;
}

const EVENT_TYPES = [
  'Trip', 'Friends', 'Family', 'Wedding', 'Birthday',
  'Office', 'College', 'Festival', 'Custom'
];

// Helper to resiliently map relative URLs to backend API host, correcting legacy port values
const resolveImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace('http://localhost:4000', 'http://localhost:4001');
  }
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `http://localhost:4001${cleanUrl}`;
};

const AlbumDetail: React.FC<AlbumDetailProps> = ({ loggedInUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', eventType: 'Trip', date: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>('');
  
  // Photo management state
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<number[]>([]);
  const [isRemovingMode, setIsRemovingMode] = useState(false);
  const [itemIdsToRemove, setItemIdsToRemove] = useState<number[]>([]);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [uploadingCapture, setUploadingCapture] = useState(false);

  const loggedInUserId = loggedInUser ? Number(loggedInUser.id) : null;

  // Race condition / double-fetching prevention ref
  const lastFetchedRef = useRef<{ id: string; userId: number | null } | null>(null);

  const getStatusLabel = (item: any) => {
    if (item.uploadStatus === 'uploading') return 'Uploading';
    if (item.scanStatus === 'pending' || item.scanStatus === 'face_scan') return 'Processing';
    if (item.metadataStatus === 'pending' || item.metadataStatus === 'object_detection' || item.metadataStatus === 'metadata_generation') return 'Metadata Pending';
    return null;
  };

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
    if (id) {
      const currentUserId = loggedInUserId;
      // Skip redundant refetches if we've already fetched this combination
      if (lastFetchedRef.current?.id === id && lastFetchedRef.current?.userId === currentUserId) {
        return;
      }
      lastFetchedRef.current = { id, userId: currentUserId };
      loadAlbum(Number(id), currentUserId || 0);
    }
  }, [id, loggedInUserId]);

  useEffect(() => {
    if (album?.items && album.items.length > 0) {
      // Start with the thumbnail URL, or full URL as fallback
      setCoverUrl(album.items[0].thumbnailUrl || album.items[0].url);
    } else {
      setCoverUrl('');
    }
  }, [album?.id, album?.items?.length]);

  const loadAlbum = async (albumId: number, uId: number) => {
    setLoading(true);
    try {
      const data = await fetchAlbumById(albumId, uId);
      setAlbum(data);
      setEditForm({ 
        title: data.title || '', 
        description: data.description || '', 
        eventType: data.eventType || 'Trip',
        date: data.date || '',
        location: data.location || ''
      });
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
    if (!id || !window.confirm('Are you sure you want to delete this event permanently?')) return;
    try {
      await deleteAlbum(Number(id), loggedInUserId || 0);
      navigate('/albums');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!id || !editForm.title.trim()) return;
    
    setSaving(true);
    try {
      const currentItemIds = album.items.map((item: any) => item.id);
      let newItemIds = [...currentItemIds];
      
      if (itemIdsToRemove.length > 0) {
        newItemIds = newItemIds.filter(itemId => !itemIdsToRemove.includes(itemId));
      }
      
      if (selectedGalleryIds.length > 0) {
        const toAdd = selectedGalleryIds.filter(itemId => !newItemIds.includes(itemId));
        newItemIds = [...newItemIds, ...toAdd];
      }

      const updated = await editAlbum(Number(id), loggedInUserId || 0, {
        ...editForm,
        itemIds: newItemIds
      });
      
      setAlbum({ ...album, ...updated });
      setIsEditing(false);
      setIsRemovingMode(false);
      setShowAddPhotos(false);
      setItemIdsToRemove([]);
      setSelectedGalleryIds([]);
      setMessage({ type: 'success', text: 'Event updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCapturePhoto = async (file: File) => {
    setShowCamera(false);
    setUploadingCapture(true);
    try {
      const formData = new FormData();
      formData.append('gallery', file);
      const res = await uploadGallery(formData, loggedInUserId || undefined);
      let newPhoto = null;
      if (Array.isArray(res) && res.length > 0) newPhoto = res[0];
      else if (res && res.gallery && res.gallery.length > 0) newPhoto = res.gallery[0];
      
      if (newPhoto) {
        const currentIds = album.items ? album.items.map((i: any) => i.id) : [];
        const updated = await editAlbum(Number(id), loggedInUserId || 0, {
          itemIds: [newPhoto.id, ...currentIds]
        });
        setAlbum({ ...album, ...updated });
        setMessage({ type: 'success', text: 'Captured photo added to event!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload photo' });
    } finally {
      setUploadingCapture(false);
    }
  };

  const openAddPhotosModal = async () => {
    setShowAddPhotos(true);
    setLoadingGallery(true);
    try {
      const data = await fetchGallery();
      setGalleryImages(data.filter((img: any) => !img.isProfile));
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load gallery' });
    } finally {
      setLoadingGallery(false);
    }
  };

  const toggleGallerySelection = (imgId: number) => {
    setSelectedGalleryIds(prev => 
      prev.includes(imgId) ? prev.filter(i => i !== imgId) : [...prev, imgId]
    );
  };

  const toggleRemoval = (imgId: number) => {
    setItemIdsToRemove(prev => 
      prev.includes(imgId) ? prev.filter(i => i !== imgId) : [...prev, imgId]
    );
  };

  // Loading skeleton in premium light theme
  if (loading) return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ 
        height: '240px', 
        background: 'linear-gradient(to right, #ffffff, #f8fafc)', 
        borderRadius: '24px', 
        marginBottom: '3rem', 
        animation: 'pulseSkeleton 1.6s infinite ease-in-out', 
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }} />
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '1.25rem' 
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} style={{ 
            aspectRatio: '1/1', 
            background: '#f1f5f9', 
            borderRadius: '20px', 
            animation: 'pulseSkeleton 1.6s infinite ease-in-out', 
            animationDelay: `${i * 0.05}s`, 
            border: '1px solid #e2e8f0'
          }} />
        ))}
      </div>
      <style>{`
        @keyframes pulseSkeleton {
          0% { opacity: 0.6; background-color: #f1f5f9; }
          50% { opacity: 0.9; background-color: #e2e8f0; }
          100% { opacity: 0.6; background-color: #f1f5f9; }
        }
      `}</style>
    </div>
  );

  if (!album) return (
    <div className="text-center p-20">
      <div style={{ background: '#ffffff', padding: '3rem', borderRadius: '28px', maxWidth: '440px', margin: '0 auto', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <ImageIcon size={64} style={{ color: '#6366f1', opacity: 0.5, marginBottom: '1.5rem' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>Event not found</h1>
        <p className="text-muted" style={{ marginBottom: '2.5rem', color: '#64748b' }}>This event might have been deleted or the link is incorrect.</p>
        <Link to="/albums" className="btn btn-primary" style={{ padding: '0.8rem 2rem', borderRadius: '99px', fontWeight: 800 }}>Back to Events</Link>
      </div>
    </div>
  );

  const totalPhotos = album.items ? album.items.length : 0;
  const eventDate = album.date || new Date(album.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const eventLoc = album.location || 'Various Locations';

  const flatItems = album ? (album.items || []) : [];
  const currentIndex = selectedImage ? flatItems.findIndex((i: any) => Number(i.id) === Number(selectedImage.id)) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < flatItems.length - 1;

  const onPrev = () => {
    if (hasPrev) setSelectedImage(flatItems[currentIndex - 1]);
  };

  const onNext = () => {
    if (hasNext) setSelectedImage(flatItems[currentIndex + 1]);
  };

  const handleImageUpdated = (updated: any) => {
    setAlbum((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item: any) => item.id === updated.id ? updated : item)
      };
    });
    setSelectedImage(updated);
  };

  const handleImageDeleted = (deletedId: any) => {
    setAlbum((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item: any) => item.id !== deletedId)
      };
    });
    setSelectedImage(null);
  };

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '1.5rem 1.5rem 5rem',
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      {uploadingCapture && (
        <div style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', background: '#e0e7ff', borderRadius: '16px', border: '1px solid #818cf8', display: 'flex', alignItems: 'center', gap: '1rem', color: '#3730a3', fontWeight: 700 }}>
          <Loader2 size={20} className="spin" style={{ color: '#4f46e5' }} />
          <span>Uploading captured photo to event...</span>
        </div>
      )}

      {/* Modern Event Header Card (Light Theme) */}
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '2.5rem',
        marginBottom: '2.5rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)',
        display: 'flex',
        gap: '2.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        border: '1px solid #e2e8f0'
      }}>
        {/* Soft Background cover glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: coverUrl ? `url(${resolveImageUrl(coverUrl)}) center/cover no-repeat` : 'none',
          filter: 'blur(50px) saturate(1.5) brightness(0.98)',
          opacity: coverUrl ? 0.07 : 0,
          zIndex: 0
        }} />

        {/* Cover Thumbnail */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }}
          style={{ 
            width: '180px', height: '180px', borderRadius: '18px', overflow: 'hidden', 
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)', zIndex: 1, position: 'relative',
            background: '#f8fafc', flexShrink: 0, border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {coverUrl ? (
            <img 
              src={resolveImageUrl(coverUrl)} 
              alt=""
              onError={() => {
                const firstItem = album?.items?.[0];
                if (firstItem && coverUrl !== firstItem.url) {
                  // Fall back from the thumbnail URL to full-size URL instantly on error
                  setCoverUrl(firstItem.url);
                } else {
                  setCoverUrl('');
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <ImageIcon size={32} style={{ color: '#cbd5e1' }} />
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>No photos yet</span>
            </div>
          )}
          {album.title && (
            <div style={{ 
              position: 'absolute', top: 12, left: 12, 
              padding: '4px 12px', borderRadius: 20, 
              background: 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(8px)', 
              color: '#4f46e5', fontSize: '0.75rem', fontWeight: 800, 
              letterSpacing: '0.5px', 
              border: '1px solid #e2e8f0', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }} title={album.title}>
              {album.title}
            </div>
          )}
        </motion.div>

        {/* Text & Metadata Column */}
        <div style={{ flex: 1, zIndex: 1, minWidth: '300px' }}>
          <Link to="/albums" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4f46e5', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            <ChevronLeft size={16} /> All Events
          </Link>

          {isEditing ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="text" value={editForm.title} 
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Event Name"
                style={{ 
                  width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', 
                  color: '#0f172a', padding: '12px 16px', borderRadius: '14px', fontSize: '1.5rem', fontWeight: 800, outline: 'none'
                }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <select
                  value={editForm.eventType}
                  onChange={e => setEditForm({ ...editForm, eventType: e.target.value })}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '14px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input 
                  type="text" value={editForm.date} 
                  onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  placeholder="Date (e.g. May 2026)"
                  style={{ width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '12px 16px', borderRadius: '14px', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>
              <input 
                type="text" value={editForm.location} 
                onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="Location (e.g. Goa, Shimla)"
                style={{ width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '12px 16px', borderRadius: '14px', fontSize: '0.95rem', outline: 'none' }}
              />
              <textarea 
                value={editForm.description} 
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Event description or notes..."
                rows={2}
                style={{ width: '100%', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '12px 16px', borderRadius: '14px', fontSize: '0.95rem', resize: 'none', outline: 'none' }}
              />
            </motion.div>
          ) : (
            <>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', margin: '0 0 0.5rem' }}>{album.title}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', color: '#64748b', fontSize: '0.9rem', fontWeight: 600, marginTop: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} style={{ color: '#4f46e5' }} /> {eventDate}</span>
                <span style={{ opacity: 0.3 }}>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} style={{ color: '#4f46e5' }} /> {eventLoc}</span>
                <span style={{ opacity: 0.3 }}>•</span>
                <span style={{ color: '#4f46e5', background: '#e0e7ff', padding: '4px 12px', borderRadius: '99px', fontWeight: 800 }}>{totalPhotos} {totalPhotos === 1 ? 'photo' : 'photos'}</span>
              </div>
              {album.description && <p style={{ marginTop: '1.25rem', color: '#475569', fontSize: '0.95rem', maxWidth: '700px', lineHeight: 1.6 }}>{album.description}</p>}
            </>
          )}
        </div>

        {/* Action Controls (Clean alignment in top-right of album header) */}
        <div style={{ display: 'flex', gap: '0.75rem', zIndex: 1, alignSelf: 'flex-start' }}>
          {isEditing ? (
            <>
              <button onClick={() => handleEditSubmit()} disabled={saving} className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                <Save size={16} /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setIsEditing(false); setIsRemovingMode(false); setItemIdsToRemove([]); }} style={{ padding: '0.6rem 1.25rem', borderRadius: '99px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setIsEditing(true)} style={{ background: '#4f46e5', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '99px', border: 'none', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.15)' }}>
                <Edit2 size={14} /> Edit
              </button>
              <button onClick={handleShare} style={{ background: '#ffffff', color: '#475569', padding: '0.6rem', borderRadius: '99px', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }} title="Share Link">
                <Share2 size={16} />
              </button>
              <button onClick={handleDelete} style={{ background: '#fef2f2', color: '#ef4444', padding: '0.6rem', borderRadius: '99px', border: '1px solid #fca5a5', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete Event">
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Actions Bar (Visible to everyone - no login check) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={20} style={{ color: '#4f46e5' }} /> Event Memories
        </h2>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={openAddPhotosModal} 
            className="btn btn-primary"
            style={{ padding: '0.6rem 1.25rem', borderRadius: '99px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', boxShadow: '0 4px 12px rgba(79,70,229,0.15)' }}
          >
            <Plus size={16} /> Add Photos
          </button>
          <button 
            onClick={() => setShowCamera(true)} 
            style={{ background: '#ffffff', color: '#0f172a', padding: '0.6rem 1.25rem', borderRadius: '99px', border: '1px solid #cbd5e1', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Camera size={16} style={{ color: '#4f46e5' }} /> Capture Photo
          </button>
          <button 
            onClick={() => setIsRemovingMode(!isRemovingMode)} 
            style={{ background: isRemovingMode ? '#ef4444' : 'transparent', color: isRemovingMode ? 'white' : '#ef4444', padding: '0.6rem 1.25rem', borderRadius: '99px', border: '1px solid #ef4444', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {isRemovingMode ? 'Exit Removal' : 'Select to Remove'}
          </button>
        </div>
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '900px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button onClick={() => setShowCamera(false)} style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', padding: '10px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <X size={20} />
                </button>
              </div>
              <CameraCapture onCapture={handleCapturePhoto} onCancel={() => setShowCamera(false)} />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Organized Photos Stack */}
      {album.items.length === 0 ? (
        <div style={{ padding: '6rem 2rem', textAlign: 'center', background: '#ffffff', borderRadius: '24px', border: '2px dashed #cbd5e1', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <ImageIcon size={48} style={{ opacity: 0.5, color: '#94a3b8', marginBottom: '1.25rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>No photos in this album yet</h3>
          <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto 2rem', fontSize: '0.9rem', color: '#64748b' }}>Click "Add Photos" or "Capture Photo" above to fill your event collection with cherished moments.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={openAddPhotosModal} className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '99px', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Add Photos
            </button>
            <button onClick={() => setShowCamera(true)} style={{ background: '#ffffff', color: '#0f172a', padding: '0.6rem 1.5rem', borderRadius: '99px', border: '1px solid #cbd5e1', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={16} /> Capture
            </button>
          </div>
        </div>
      ) : (
        <div className="google-photos-flow">
          <AnimatePresence>
            {groupedItems.map((group) => (
              <div key={group.title} className="date-bucket" style={{ marginBottom: '2.5rem' }}>
                {/* Sticky Header in Light Theme */}
                <div style={{
                  position: 'sticky',
                  top: '10px', 
                  zIndex: 20,
                  padding: '0.6rem 1.25rem',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: '99px',
                  marginBottom: '1rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                    {group.title}
                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#4f46e5', background: '#e0e7ff', padding: '2px 8px', borderRadius: '99px' }}>
                      {group.items.length}
                    </span>
                  </h3>
                </div>

                <div className="grid-layer" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '1rem'
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
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        aspectRatio: '1 / 1', 
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                        border: itemIdsToRemove.includes(item.id) ? '3px solid #ef4444' : '1px solid #e2e8f0',
                        background: '#f8fafc'
                      }}
                      onClick={() => isRemovingMode ? toggleRemoval(item.id) : setSelectedImage(item)}
                    >
                      <img 
                        src={resolveImageUrl(item.thumbnailUrl || item.url)} 
                        alt="" 
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fullUrl = resolveImageUrl(item.url);
                          if (target.src !== fullUrl) {
                            target.src = fullUrl;
                          }
                        }}
                        style={{ 
                          width: '100%', height: '100%', objectFit: 'cover',
                          opacity: itemIdsToRemove.includes(item.id) ? 0.4 : 1,
                          transition: 'opacity 0.2s'
                        }} 
                      />

                      {!isRemovingMode && item.recognizedUsers && item.recognizedUsers.length > 0 && (
                        <div style={{
                          position: 'absolute', bottom: '10px', left: '10px', right: '10px',
                          display: 'flex', flexWrap: 'wrap', gap: '4px', zIndex: 10
                        }}>
                          {item.recognizedUsers.slice(0, 2).map((user: any) => (
                            <div
                              key={user.id}
                              style={{
                                background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)',
                                padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#0f172a',
                                display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #e2e8f0',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                              }}
                            >
                              <div style={{ width: 16, height: 16, borderRadius: '50%', overflow: 'hidden' }}>
                                <img src={resolveImageUrl(user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.name.split(' ')[0]}</span>
                            </div>
                          ))}
                          {item.recognizedUsers.length > 2 && (
                            <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, color: '#4f46e5', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                              +{item.recognizedUsers.length - 2}
                            </div>
                          )}
                        </div>
                      )}

                      {!isRemovingMode && getStatusLabel(item) && (
                        <div style={{
                          position: 'absolute', top: '10px', left: '10px',
                          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)',
                          padding: '4px 10px', borderRadius: '8px', color: '#0f172a',
                          fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center',
                          gap: '6px', zIndex: 15, border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
                        }}>
                          <Loader2 size={10} className="spin" style={{ color: '#4f46e5' }} />
                          <span>{getStatusLabel(item)?.toUpperCase()}</span>
                        </div>
                      )}

                      {isRemovingMode && (
                        <div style={{ 
                          position: 'absolute', top: '10px', right: '10px', 
                          background: itemIdsToRemove.includes(item.id) ? '#ef4444' : 'rgba(255,255,255,0.95)', 
                          borderRadius: '50%', color: itemIdsToRemove.includes(item.id) ? 'white' : '#64748b', width: 28, height: 28, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                          backdropFilter: 'blur(4px)', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                        }}>
                          {itemIdsToRemove.includes(item.id) ? <CheckCircle2 size={18} /> : <X size={16} />}
                        </div>
                      )}

                      {!isRemovingMode && (
                        <div className="hover-layer" style={{
                          position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(4px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'all 0.2s', zIndex: 5
                        }}>
                          <div style={{ background: 'white', borderRadius: '99px', padding: '8px 16px', color: '#0f172a', fontSize: '0.8rem', fontWeight: 800, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                             <ImageIcon size={14} style={{ color: '#4f46e5' }} /> View Photo
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

      {/* Photo Selection Modal (Light Theme Redesign) */}
      <AnimatePresence>
        {showAddPhotos && (
          <div style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(15, 23, 42, 0.4)', zIndex: 5000, display: 'flex', alignItems: 'center', 
            justifyContent: 'center', backdropFilter: 'blur(8px)'
          }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ 
                width: '90vw', maxWidth: '1200px', height: '85vh', background: '#ffffff', 
                borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 50px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ padding: '2rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Add Photos to Event</h2>
                  <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#64748b' }}>Select photos from your gallery to include in {album.title}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setShowAddPhotos(false)} style={{ padding: '10px 20px', borderRadius: '99px', background: 'transparent', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => handleEditSubmit()} disabled={saving || selectedGalleryIds.length === 0} className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '99px', fontWeight: 800, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79,70,229,0.15)' }}>
                    <Plus size={16} /> Add {selectedGalleryIds.length} Selected
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '3rem' }} className="custom-scrollbar">
                {loadingGallery ? (
                   <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><Loader2 size={32} className="spin" style={{ color: '#4f46e5' }} /></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    {galleryImages.map((img: any) => (
                      <div 
                        key={img.id} 
                        onClick={() => toggleGallerySelection(img.id)}
                        style={{ 
                          position: 'relative', aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer',
                          border: selectedGalleryIds.includes(img.id) ? '4px solid #4f46e5' : '2px solid transparent',
                          transform: selectedGalleryIds.includes(img.id) ? 'scale(1.02)' : 'none',
                          transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                        }}
                      >
                        <img 
                          src={resolveImageUrl(img.thumbnailUrl || img.url)} 
                          alt="" 
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const fullUrl = resolveImageUrl(img.url);
                            if (target.src !== fullUrl) {
                              target.src = fullUrl;
                            }
                          }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <div style={{ 
                          position: 'absolute', top: '12px', right: '12px', 
                          background: selectedGalleryIds.includes(img.id) ? '#4f46e5' : 'rgba(255,255,255,0.9)',
                          width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(4px)', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                        }}>
                          {selectedGalleryIds.includes(img.id) && <CheckCircle2 size={20} color="white" />}
                        </div>
                        {album.items.some((ai: any) => ai.id === img.id) && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', color: '#4f46e5', fontSize: '0.75rem', padding: '8px', textAlign: 'center', fontWeight: 800, backdropFilter: 'blur(4px)', borderTop: '1px solid #e2e8f0' }}>ALREADY IN EVENT</div>
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

      <AnimatePresence>
        {selectedImage && (
          <ImageDetailModal
            selectedImage={selectedImage}
            onClose={() => setSelectedImage(null)}
            loggedInUser={loggedInUser}
            onPrev={onPrev}
            onNext={onNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onImageUpdated={handleImageUpdated}
            onImageDeleted={handleImageDeleted}
          />
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
            gap: '1rem', padding: '1rem 2rem', borderRadius: '99px', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: message.type === 'error' ? '#ef4444' : '#10b981',
            color: 'white', fontWeight: 700
          }}
        >
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {message.text}
        </motion.div>
      )}

      <style>{`
        .grid-layer > div:hover .hover-layer {
          opacity: 1 !important;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
};

export default AlbumDetail;
