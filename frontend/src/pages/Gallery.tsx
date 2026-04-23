import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Camera, X, ChevronLeft, ChevronRight, Album as AlbumIcon, CheckSquare, Square, Share2, Hash, RefreshCw, RotateCcw, ChevronDown, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';
import { fetchGallery, uploadGallery, refreshGallery, getSyncStatus, setGalleryItemHashtags, deleteGalleryItem, untagFaceInPhoto } from '../services/galleryService';
import { createAlbum } from '../services/albumService';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  originalId?: number;
}

interface GalleryItem {
  id: number | string;
  url: string;
  label?: string;
  isProfile: boolean;
  recognizedUsers?: UserProfile[];
  faces?: any[];
  hashtags?: string[];
}

interface GalleryProps {
  loggedInUser: UserProfile | null;
}

const Gallery: React.FC<GalleryProps> = ({ loggedInUser }) => {
  const navigate = useNavigate();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'global'>(() => (loggedInUser ? 'personal' : 'global'));
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [editingHashtags, setEditingHashtags] = useState(false);
  const [hashtagsDraft, setHashtagsDraft] = useState('');
  const [savingHashtags, setSavingHashtags] = useState(false);
  const [openHashtagsEditorNext, setOpenHashtagsEditorNext] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [scanningBanner, setScanningBanner] = useState<{ count: number; progress: number; done: boolean } | null>(null);
  const scanTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Album Selection State ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  const loggedInUserId = loggedInUser ? Number(loggedInUser.originalId ?? loggedInUser.id) : null;

  const parsedHashtagsDraft = useMemo(() => {
    const raw = (hashtagsDraft || '').trim();
    if (!raw) return [];
    const hashtagMatches = raw.match(/#[a-z0-9_-]+/gi);
    const parts = (hashtagMatches && hashtagMatches.length > 0) ? hashtagMatches : raw.split(/[\s,]+/g);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of parts) {
      const norm = p.trim().replace(/^#+/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
      if (!norm) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
      if (out.length >= 20) break;
    }
    return out;
  }, [hashtagsDraft]);

  useEffect(() => {
    loadGallery();
  }, [loggedInUserId, viewMode]);

  useEffect(() => {
    // If user is not logged in, personal mode makes no sense (and leads to confusing empty-state text).
    if (!loggedInUserId && viewMode === 'personal') setViewMode('global');
  }, [loggedInUserId, viewMode]);

  useEffect(() => {
    if (!selectedImage || selectedImage.isProfile) return;
    const tags = Array.isArray(selectedImage.hashtags) ? selectedImage.hashtags : [];
    setHashtagsDraft(tags.map(t => `#${t}`).join(' '));
    setEditingHashtags(openHashtagsEditorNext);
    setOpenHashtagsEditorNext(false);
  }, [selectedImage?.id]);

  const loadGallery = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Determine what to fetch based on viewMode and login status
      const userIdToFetch = (viewMode === 'personal' && loggedInUserId) ? loggedInUserId : undefined;
      const data = await fetchGallery(userIdToFetch);
      setImages(data);
    } catch (err) {
      console.error(err);
      setImages([]);
      setMessage({ type: 'error', text: (err as any).message });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshRecognition = async (forceRescan = false) => {
    setRefreshing(true);
    setSyncMenuOpen(false);
    setMessage({ type: 'info', text: forceRescan ? 'Force rescan started in background...' : 'AI sync started in background...' });
    try {
      await refreshGallery(forceRescan);
    } catch (err) {
      setMessage({ type: 'error', text: 'Sync failed to start. Please try again later.' });
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (refreshing) {
      interval = setInterval(async () => {
        try {
          const status = await getSyncStatus();
          if (status && status.isScanning) {
            setMessage({ type: 'info', text: `AI task running: ${status.current} / ${status.total}` });
          } else if (status && !status.isScanning) {
            setRefreshing(false);
            if (interval) clearInterval(interval);
            await loadGallery(true);
            setMessage({ type: 'success', text: 'AI sync complete. Gallery updated.' });
            setTimeout(() => setMessage(null), 5000);
          }
        } catch {
          // ignore transient status errors
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refreshing]);

  useEffect(() => {
    if (!syncMenuOpen) return;
    const onDocClick = () => setSyncMenuOpen(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [syncMenuOpen]);

  const uploadImages = async (files: File[]) => {
    setUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('gallery', file));

    try {
      await uploadGallery(formData, loggedInUserId || undefined);
      await loadGallery(true);

      // Start scanning banner with real progress polling
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      setScanningBanner({ count: files.length, progress: 0, done: false });

      // Poll the real sync status for accurate progress
      const POLL_MS = 800;
      // Give the backend a moment to kick off the scan
      await new Promise(r => setTimeout(r, 600));

      scanTimerRef.current = setInterval(async () => {
        try {
          const status = await getSyncStatus();
          if (status && status.isScanning) {
            const total = status.total || files.length;
            const current = status.current || 0;
            const pct = total > 0 ? Math.min(99, Math.round((current / total) * 100)) : 0;
            setScanningBanner(prev => prev ? { ...prev, progress: pct, done: false } : null);
          } else {
            // Scan finished
            clearInterval(scanTimerRef.current!);
            scanTimerRef.current = null;
            setScanningBanner(prev => prev ? { ...prev, progress: 100, done: true } : null);
            
            // Fetch updated data silently
            const userIdToFetch = (viewMode === 'personal' && loggedInUserId) ? loggedInUserId : undefined;
            const updatedData = await fetchGallery(userIdToFetch);
            setImages(updatedData);

            // If a preview is currently open, update its tags too!
            if (selectedImage) {
              const freshImg = updatedData.find((i: any) => i.id === selectedImage.id);
              if (freshImg) setSelectedImage(freshImg);
            }
            setTimeout(() => setScanningBanner(null), 3000);
          }
        } catch {
          // ignore transient poll errors
        }
      }, POLL_MS);
    } catch (err) {
      setMessage({ type: 'error', text: (err as any).message });
    } finally {
      setUploading(false);
    }
  };

  const handleMultipleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    if (files.length > 0) uploadImages(files);
  };

  const handleOpenPreview = (img: GalleryItem, index: number) => {
    setOpenHashtagsEditorNext(false);
    setSelectedImage(img);
    setCurrentIndex(index);
  };

  const handleOpenHashtags = (img: GalleryItem, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (img.isProfile) return;
    setOpenHashtagsEditorNext(true);
    setSelectedImage(img);
    setCurrentIndex(index);
  };

  const handleClosePreview = () => {
    setSelectedImage(null);
  };

  const handleNextImage = () => {
    if (currentIndex < images.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setSelectedImage(images[nextIndex]);
    }
  };

  const handlePrevImage = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setSelectedImage(images[prevIndex]);
    }
  };

  const handleCameraCapture = async (file: File) => {
    setShowCamera(false);
    await uploadImages([file]);
  };

  const handleSaveHashtags = async () => {
    if (!selectedImage || selectedImage.isProfile) return;
    const itemId = typeof selectedImage.id === 'string'
      ? parseInt(selectedImage.id.replace('profile-', ''), 10)
      : selectedImage.id;
    if (isNaN(itemId as number)) return;

    setSavingHashtags(true);
    try {
      const updated = await setGalleryItemHashtags(itemId as number, parsedHashtagsDraft);
      const updatedTags = Array.isArray(updated?.hashtags) ? updated.hashtags : [];

      setImages(prev => prev.map(img => {
        const id = typeof img.id === 'string' ? parseInt(img.id.replace('profile-', ''), 10) : img.id;
        return id === itemId ? { ...img, hashtags: updatedTags } : img;
      }));
      setSelectedImage(prev => prev ? { ...prev, hashtags: updatedTags } : prev);
      setEditingHashtags(false);
      setMessage({ type: 'success', text: 'Hashtags updated.' });
      setTimeout(() => setMessage(null), 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update hashtags.' });
    } finally {
      setSavingHashtags(false);
    }
  };

  const handleDeleteImage = async (img: GalleryItem) => {
    if (img.isProfile) {
      setMessage({ type: 'error', text: 'Profile photos cannot be deleted from the gallery.' });
      return;
    }
    const id = typeof img.id === 'string' ? parseInt(img.id.replace('profile-', ''), 10) : img.id;
    if (isNaN(id as number)) return;
    const confirmed = window.confirm('Delete this photo permanently? This cannot be undone.');
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteGalleryItem(id as number);
      // Remove from state immediately (optimistic)
      setImages(prev => prev.filter(i => i.id !== img.id));
      if (selectedImage?.id === img.id) {
        // Move to next/prev or close
        const idx = images.findIndex(i => i.id === img.id);
        const remaining = images.filter(i => i.id !== img.id);
        if (remaining.length === 0) {
          setSelectedImage(null);
        } else {
          const nextIdx = Math.min(idx, remaining.length - 1);
          setSelectedImage(remaining[nextIdx]);
          setCurrentIndex(nextIdx);
        }
      }
      setMessage({ type: 'success', text: 'Photo deleted successfully.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete photo.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleUntagUser = async (user: UserProfile, img?: GalleryItem) => {
    const item = img || selectedImage;
    if (!item) return;
    const itemId = typeof item.id === 'string'
      ? parseInt(item.id.replace('profile-', ''), 10)
      : item.id;
    
    if (isNaN(itemId as number)) return;

    const confirmed = window.confirm(`Remove "${user.name}" from this photo? AI will not re-tag them here.`);
    if (!confirmed) return;

    try {
      await untagFaceInPhoto(itemId as number, user.id);
      
      // Update local state
      const updatedRecognizedUsers = (item.recognizedUsers || []).filter(u => u.id !== user.id);
      
      setImages(prev => prev.map(i => {
        const id = typeof i.id === 'string' ? parseInt(i.id.replace('profile-', ''), 10) : i.id;
        return id === itemId ? { ...i, recognizedUsers: updatedRecognizedUsers } : i;
      }));
      
      if (selectedImage && (selectedImage.id === item.id)) {
        setSelectedImage(prev => prev ? { ...prev, recognizedUsers: updatedRecognizedUsers } : prev);
      }
      setMessage({ type: 'success', text: `Removed ${user.name} from photo.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove tag.' });
    }
  };

  // --- Album Selection Handlers ---
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds([]);
  };

  const toggleImageSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumTitle.trim() || selectedIds.length === 0 || !loggedInUserId) return;
    setCreatingAlbum(true);
    try {
      const album = await createAlbum({
        title: newAlbumTitle,
        userId: loggedInUserId,
        itemIds: selectedIds,
        isGlobal: true, // New albums are global by default as requested
      });
      setMessage({ type: 'success', text: `Album "${album.title}" created successfully!` });
      setIsSelectionMode(false);
      setSelectedIds([]);
      setNewAlbumTitle('');
      setShowAlbumModal(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create album' });
    } finally {
      setCreatingAlbum(false);
    }
  };

  return (
    <div style={{ paddingBottom: '5rem' }}>

      {/* AI SCANNING BANNER — real progress from server */}
      <AnimatePresence>
        {scanningBanner && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            style={{
              position: 'fixed', bottom: '2rem', left: '2rem',
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              color: 'white', borderRadius: '20px', padding: '1.25rem 1.5rem',
              boxShadow: '0 20px 50px rgba(99,102,241,0.35)', zIndex: 9999,
              minWidth: '300px', maxWidth: '340px',
              border: '1px solid rgba(255,255,255,0.15)'
            }}
          >
            {/* Close / dismiss button */}
            <button
              onClick={() => {
                if (scanTimerRef.current) clearInterval(scanTimerRef.current);
                scanTimerRef.current = null;
                setScanningBanner(null);
              }}
              title="Dismiss"
              style={{
                position: 'absolute', top: 10, right: 12,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                fontSize: '0.8rem', lineHeight: 1, borderRadius: '50%',
                width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >✕</button>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem', paddingRight: '1.5rem' }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: scanningBanner.done ? '#10b981' : '#a5b4fc',
                boxShadow: !scanningBanner.done ? '0 0 0 4px rgba(165,180,252,0.25)' : 'none',
                animation: !scanningBanner.done ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', lineHeight: 1.3 }}>
                  {scanningBanner.done
                    ? '✅ Scan Complete!'
                    : `AI scanning ${scanningBanner.count} photo${scanningBanner.count > 1 ? 's' : ''}…`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                  {scanningBanner.done
                    ? 'Gallery updated with face recognition tags.'
                    : 'Detecting faces in background — you can keep browsing.'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 7, overflow: 'hidden', marginBottom: 5 }}>
              <motion.div
                animate={{ width: `${scanningBanner.progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                  height: '100%', borderRadius: 99,
                  background: scanningBanner.done
                    ? '#10b981'
                    : 'linear-gradient(90deg, #818cf8, #c084fc, #f472b6)'
                }}
              />
            </div>

            {/* Percentage label */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
              <span>{scanningBanner.done ? 'Done' : 'Processing…'}</span>
              <span>{scanningBanner.progress}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '3rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {viewMode === 'personal' && loggedInUser ? 'Captured Moments' : 'Global Discovery'}
          </h2>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>
            {viewMode === 'personal' && loggedInUser
              ? `Smart gallery showing photos matched to ${loggedInUser.name}.`
              : 'Explore all community photos and identified profiles. To label unknown faces, use the People page.'}
          </p>
        </div>

        <div className="flex items-center gap-4" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {loggedInUser && (
            <div className="toggle-group" style={{
              display: 'flex',
              background: 'var(--border-color)',
              padding: '4px',
              borderRadius: '12px',
              marginRight: '1rem'
            }}>
              <button
                onClick={() => setViewMode('personal')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'personal' ? 'white' : 'transparent',
                  boxShadow: viewMode === 'personal' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  color: viewMode === 'personal' ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                My Photos
              </button>
              <button
                onClick={() => setViewMode('global')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'global' ? 'white' : 'transparent',
                  boxShadow: viewMode === 'global' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  color: viewMode === 'global' ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                Global
              </button>
            </div>
          )}

          <div className="flex gap-2" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setSyncMenuOpen(v => !v); }}
                className="btn btn-outline"
                disabled={refreshing}
                style={{ padding: '0.75rem 1.15rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                title="Background AI sync tools"
              >
                <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                Sync
                <ChevronDown size={16} />
              </button>

              {syncMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    left: 0,
                    minWidth: 220,
                    background: 'white',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
                    padding: 8,
                    zIndex: 50,
                  }}
                >
                  <button
                    className="btn"
                    disabled={refreshing}
                    onClick={() => handleRefreshRecognition(false)}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'transparent',
                      border: 'none',
                      fontWeight: 800,
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RefreshCw size={16} /> AI Sync (recommended)
                  </button>
                  <button
                    className="btn"
                    disabled={refreshing}
                    onClick={() => {
                      const ok = window.confirm('Force Rescan is slower and re-detects faces. Continue?');
                      if (ok) handleRefreshRecognition(true);
                      else setSyncMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(245,158,11,0.08)',
                      border: 'none',
                      fontWeight: 900,
                      color: '#b45309',
                      cursor: refreshing ? 'not-allowed' : 'pointer',
                    }}
                    title="Advanced: clears caches and forces re-detection"
                  >
                    <RotateCcw size={16} /> Force Rescan (advanced)
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowCamera(true)}
              className="btn btn-outline"
              style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
            >
              <Camera size={20} /> Capture Photo
            </button>
            <label className="btn btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
              <Plus size={20} /> Upload Files
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleMultipleUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card mb-8"
            style={{ maxWidth: '600px', margin: '0 auto 3rem', position: 'relative', overflow: 'hidden' }}
          >
            <div className="flex justify-between items-center mb-6" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                  <ImageIcon size={20} />
                </div>
                <h3 style={{ margin: 0, fontWeight: 700 }}>Capture Photo</h3>
              </div>
              <button onClick={() => setShowCamera(false)} className="btn btn-danger" style={{ padding: '8px', borderRadius: '50%' }}>
                <X size={20} />
              </button>
            </div>
            <CameraCapture onCapture={handleCameraCapture} onCancel={() => setShowCamera(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {uploading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card text-center mb-10"
          style={{
            background: 'white',
            border: '2px dashed var(--primary)',
            padding: '3rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary)', borderWidth: '3px' }}></div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.25rem' }}>Smart Processing in Progress</h4>
            <p className="text-muted">Scanning for faces and organizing your gallery...</p>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center p-20">
          <div className="loading-spinner" style={{ margin: '0 auto 1rem', borderTopColor: 'var(--primary)' }}></div>
          <p className="text-muted">Loading your gallery...</p>
        </div>
      ) : images.length === 0 ? (
        <div className="card text-center p-20" style={{ border: '2px dashed var(--border-color)', background: 'white', borderRadius: '24px' }}>
          <div style={{
            width: '100px', height: '100px', background: 'var(--bg-main)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem'
          }}>
            <ImageIcon size={48} className="text-muted" style={{ opacity: 0.3 }} />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No memories found here</h3>
          <p className="text-muted" style={{ maxWidth: '300px', margin: '0 auto' }}>
            {viewMode === 'personal' && loggedInUser
              ? "You haven't been tagged in any photos yet. Upload some group photos to see the magic!"
              : "The global gallery is empty. Be the first to share a moment!"}
          </p>
        </div>
      ) : (
        <div className="gallery-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '2rem',
        }}>
          <AnimatePresence>
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`gallery-card ${selectedIds.includes(Number(img.id)) ? 'selected' : ''}`}
                onClick={() => toggleImageSelection(Number(img.id))}
                style={{ 
                  position: 'relative', 
                  cursor: 'pointer',
                  border: selectedIds.includes(Number(img.id)) ? '4px solid var(--primary)' : 'none',
                  transform: selectedIds.includes(Number(img.id)) ? 'scale(0.98)' : 'none',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  background: 'white'
                }}
              >
                <img
                  src={img.url}
                  alt={`Gallery item ${img.id}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '4/5' }}
                  loading="lazy"
                />
                
                {/* Visual Checkbox (Round Button) - Always visible for easy selection */}
                <div 
                  onClick={(e) => { e.stopPropagation(); toggleImageSelection(Number(img.id)); }}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: selectedIds.includes(Number(img.id)) ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    zIndex: 20,
                    border: '2px solid white',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)'
                  }}
                >
                  <CheckCircle2 size={20} style={{ opacity: selectedIds.includes(Number(img.id)) ? 1 : 0.4 }} />
                </div>

                {/* Always-Visible Identity Tags */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  right: '1rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  zIndex: 10
                }}>
                  {img.recognizedUsers && img.recognizedUsers.length > 0 && 
                    img.recognizedUsers.map((user: any) => (
                      <div
                        key={user.id}
                        style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(8px)',
                          padding: '0.25rem 0.75rem 0.25rem 0.25rem',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '50%', 
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.3)'
                        }}>
                          <img 
                            src={user.profilePicture} 
                            alt={user.name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        {user.name.split(' ')[0]}
                        {!img.isProfile && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUntagUser(user, img); }}
                            title="Remove tag"
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: 'none',
                              color: 'white',
                              cursor: 'pointer',
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '9px',
                              fontWeight: 900,
                              marginLeft: '0.2rem',
                              transition: 'all 0.2s',
                              opacity: 0.7
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))
                  }
                </div>

                {/* Hover Reveal Overlay */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    zIndex: 2
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>
                      {new Date((img as any).uploadedAt || 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenPreview(img, index); }}
                        className="btn"
                        style={{ padding: '4px 10px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}
                      >
                         Preview
                      </button>
                      {loggedInUser && !img.isProfile && (
                        <button
                          onClick={(e) => handleOpenHashtags(img, index, e)}
                          className="btn"
                          style={{ padding: '4px 9px', fontSize: '0.65rem', background: 'rgba(99,102,241,0.85)', color: 'white', fontWeight: 900, borderRadius: '10px' }}
                          title="Add hashtags"
                        >
                          <Hash size={12} /> Tags
                        </button>
                      )}
                      {!img.isProfile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteImage(img); }}
                          className="btn"
                          title="Delete photo"
                          style={{
                            padding: '4px 8px', fontSize: '0.65rem',
                            background: 'rgba(239,68,68,0.8)', color: 'white',
                            fontWeight: 900, borderRadius: '10px',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="message-toast"
          style={{
            backgroundColor: message.type === 'error' ? 'var(--error)' : message.type === 'info' ? 'var(--primary)' : 'var(--success)',
            padding: '1.25rem 2rem',
            borderRadius: '16px',
            fontSize: '1rem',
            fontWeight: 600
          }}
        >
          {message.type === 'error' ? <AlertCircle size={20} /> : message.type === 'info' ? <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div> : <CheckCircle2 size={20} />}
          {message.text}
        </motion.div>
      )}

      {/* ===== EXISTING FULL-SCREEN PREVIEW MODAL ===== */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            }}
            onClick={handleClosePreview}
          >
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 2001, display: 'flex', gap: '0.75rem' }}>
              {selectedImage && !selectedImage.isProfile && (
                <button
                  onClick={() => handleDeleteImage(selectedImage)}
                  disabled={deleting}
                  title="Delete this photo"
                  style={{
                    padding: '12px', borderRadius: '50%',
                    background: deleting ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.85)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white', cursor: deleting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}
                >
                  {deleting ? <div className="loading-spinner" style={{ width: 22, height: 22, borderWidth: 2 }} /> : <Trash2 size={22} />}
                </button>
              )}
              <button onClick={handleClosePreview} className="btn btn-danger" style={{ padding: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white' }}>
                <X size={32} />
              </button>
            </div>

            {/* Navigation Arrows */}
            <div style={{ position: 'absolute', left: '2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2001 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                className="btn"
                disabled={currentIndex === 0}
                style={{ padding: '15px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', opacity: currentIndex === 0 ? 0.2 : 1 }}
              >
                <ChevronLeft size={40} />
              </button>
            </div>

            <div style={{ position: 'absolute', right: '2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2001 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                className="btn"
                disabled={currentIndex === images.length - 1}
                style={{ padding: '15px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', opacity: currentIndex === images.length - 1 ? 0.2 : 1 }}
              >
                <ChevronRight size={40} />
              </button>
            </div>

            <motion.div
              key={selectedImage.url}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '90vw',
                maxHeight: '80vh',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2rem'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage.url}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '24px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  objectFit: 'contain',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              />

              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                padding: '1.5rem 3rem',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                zIndex: 2002
              }}>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1.1rem', opacity: 0.6 }}>Identified in this photo:</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {selectedImage.recognizedUsers && selectedImage.recognizedUsers.length > 0 ? (
                    selectedImage.recognizedUsers.map((user: any) => (
                      <div
                        key={user.id}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          padding: '0.4rem 1rem 0.4rem 0.4rem',
                          borderRadius: '999px',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2px solid rgba(255,255,255,0.2)'
                        }}>
                          <img
                            src={user.profilePicture}
                            alt={user.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        {user.name}
                        {!selectedImage.isProfile && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUntagUser(user); }}
                            title="Remove this person"
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: 'none',
                              color: '#f87171',
                              cursor: 'pointer',
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 900,
                              marginLeft: '0.4rem',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'white', opacity: 0.4, fontStyle: 'italic' }}>No faces identified yet</span>
                  )}
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                padding: '1rem 1.5rem',
                borderRadius: '22px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                width: 'min(900px, 95vw)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', opacity: 0.7, fontWeight: 800 }}>
                    <Hash size={18} /> Hashtags:
                  </div>
                  {(selectedImage.hashtags && selectedImage.hashtags.length > 0) ? (
                    selectedImage.hashtags.map((t) => (
                      <button
                        key={t}
                        onClick={() => navigate(`/tags/${encodeURIComponent(t)}`)}
                        className="btn"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '999px',
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.16)',
                          color: 'white',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                        title="Search this tag"
                      >
                        #{t}
                      </button>
                    ))
                  ) : (
                    <span style={{ color: 'white', opacity: 0.45, fontStyle: 'italic' }}>No hashtags</span>
                  )}
                </div>

                {loggedInUser && !selectedImage.isProfile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {!editingHashtags ? (
                      <button
                        onClick={() => setEditingHashtags(true)}
                        className="btn"
                        style={{
                          padding: '8px 12px',
                          borderRadius: '12px',
                          background: 'rgba(99,102,241,0.25)',
                          border: '1px solid rgba(99,102,241,0.35)',
                          color: 'white',
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                      >
                        Add / Edit
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          value={hashtagsDraft}
                          onChange={(e) => setHashtagsDraft(e.target.value)}
                          placeholder="#wedding #party"
                          style={{
                            width: 260,
                            padding: '0.55rem 0.75rem',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.18)',
                            background: 'rgba(0,0,0,0.35)',
                            color: 'white',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => { setEditingHashtags(false); setHashtagsDraft((selectedImage.hashtags || []).map(t => `#${t}`).join(' ')); }}
                          className="btn"
                          style={{ padding: '8px 10px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'white' }}
                          disabled={savingHashtags}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveHashtags}
                          className="btn"
                          style={{ padding: '8px 12px', borderRadius: 12, background: 'rgba(99,102,241,0.95)', border: 'none', color: 'white', fontWeight: 950 }}
                          disabled={savingHashtags}
                          title={parsedHashtagsDraft.length === 0 ? 'Save empty to clear tags' : 'Save hashtags'}
                        >
                          {savingHashtags ? 'Savingâ€¦' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            style={{
              position: 'fixed',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(30, 41, 59, 0.9)',
              backdropFilter: 'blur(16px)',
              padding: '1rem 2rem',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              zIndex: 1000,
              width: 'max-content'
            }}
          >
            <div style={{ color: 'white', fontWeight: 700 }}>
              {selectedIds.length} photo{selectedIds.length > 1 ? 's' : ''} selected
            </div>
            <button 
              onClick={() => setShowAlbumModal(true)}
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <AlbumIcon size={18} /> Create Album
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Album Creation Modal */}
      <AnimatePresence>
        {showAlbumModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
            }}
            onClick={() => setShowAlbumModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{
                background: '#1e293b', padding: '2.5rem', borderRadius: '24px',
                width: '90%', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ color: 'white', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 800 }}>New Album</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>Give your collection of {selectedIds.length} photos a memorable name.</p>
              
              <input
                type="text"
                placeholder="Ex: Summer Vacation 2024"
                value={newAlbumTitle}
                onChange={e => setNewAlbumTitle(e.target.value)}
                autoFocus
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', fontSize: '1rem', marginBottom: '2rem', outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowAlbumModal(false)} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button 
                  onClick={handleCreateAlbum}
                  disabled={!newAlbumTitle.trim() || creatingAlbum}
                  style={{ 
                    flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', 
                    background: 'var(--primary)', color: 'white', fontWeight: 700, 
                    cursor: newAlbumTitle.trim() ? 'pointer' : 'not-allowed', opacity: newAlbumTitle.trim() ? 1 : 0.5 
                  }}
                >
                  {creatingAlbum ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
