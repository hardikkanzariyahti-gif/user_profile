import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Camera, X, ChevronLeft, ChevronRight, RotateCcw, Tag, UserCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraCapture from '../components/CameraCapture';
import { fetchGallery, uploadGallery, refreshGallery, tagFaceInPhoto, untagFaceInPhoto, getSyncStatus } from '../services/galleryService';
import { identifyFace } from '../services/faceService';
import { fetchUsers } from '../services/userService';
import { createAlbum } from '../services/albumService';
import { Album as AlbumIcon, CheckSquare, Square, Share2 } from 'lucide-react';

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
}

interface GalleryProps {
  loggedInUser: UserProfile | null;
}

const Gallery: React.FC<GalleryProps> = ({ loggedInUser }) => {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [matchedUsers, setMatchedUsers] = useState<any[] | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'upload' | 'identify'>('upload');
  const [viewMode, setViewMode] = useState<'personal' | 'global'>('personal');
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  // --- Tag Face State ---
  const [tagModalImage, setTagModalImage] = useState<GalleryItem | null>(null);
  const [tagSelectedUserId, setTagSelectedUserId] = useState<number | null>(null);
  const [tagSelectedFaceIndex, setTagSelectedFaceIndex] = useState<number | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{w: number, h: number} | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // --- Album Selection State ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  
  useEffect(() => {
    if (tagModalImage && imgRef.current && imgRef.current.complete) {
      setImageNaturalSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  }, [tagModalImage]);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [tagging, setTagging] = useState(false);

  const loggedInUserId = loggedInUser ? Number(loggedInUser.originalId ?? loggedInUser.id) : null;

  useEffect(() => {
    loadGallery();
  }, [loggedInUserId, viewMode]);

  const loadGallery = async () => {
    setLoading(true);
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

  const uploadImages = async (files: File[]) => {
    setUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('gallery', file));

    try {
      // Always upload as the logged in user
      const updatedGallery = await uploadGallery(formData, loggedInUserId || undefined);

      // If we are in personal mode, show the updated filtered gallery
      // If we are in global mode, the backend returns everything by default (if listGallery is called with undefined)
      // but the uploadGallery controller currently calls listGallery(userId).
      // So we refresh manually to be safe.
      await loadGallery();

      setMessage({ type: 'success', text: 'Successfully added to the gallery and scanned for faces!' });
      setTimeout(() => setMessage(null), 3000);
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

  const runFaceScan = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const result = await identifyFace(formData);

    if (result.users && result.users.length > 0) {
      setMatchedUsers(result.users);
      setMessage({ type: 'success', text: result.message });
    } else {
      setMessage({ type: 'error', text: result.message || 'Unknown User' });
    }
  };

  const handleRefreshRecognition = async (forceRescan = false) => {
    setRefreshing(true);
    setMessage({ type: 'info', text: 'Initiating massive background scan...' });
    try {
      await refreshGallery(forceRescan);
    } catch (err) {
      setMessage({ type: 'error', text: 'AI Sync failed to start. Please try again later.' });
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (refreshing) {
      interval = setInterval(async () => {
        try {
          const status = await getSyncStatus();
          if (status && status.isScanning) {
             setMessage({ type: 'info', text: `⏳ AI Background Task: Scanned ${status.current} of ${status.total} photos...` });
          } else if (status && !status.isScanning) {
             setRefreshing(false);
             clearInterval(interval);
             await loadGallery();
             setMessage({ type: 'success', text: `✨ AI Task Complete! Your massive gallery has been instantly updated without crashing.` });
             setTimeout(() => setMessage(null), 5000);
          }
        } catch (e) {
             // Silently ignore ping drops
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [refreshing]);

  const handleOpenPreview = (img: GalleryItem, index: number) => {
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

  const handleScanFace = async (imgUrl: string) => {
    setMessage({ type: 'info', text: 'AI is scanning face... please wait' });

    try {
      const imageRes = await fetch(imgUrl);
      const blob = await imageRes.blob();
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
      await runFaceScan(file);
    } catch (err) {
      setMessage({ type: 'error', text: 'AI Scan failed' });
    }
  };

  const handleCameraCapture = async (file: File) => {
    setShowCamera(false);

    if (cameraMode === 'upload') {
      await uploadImages([file]);
    } else {
      setMessage({ type: 'info', text: 'Analyzing live face...' });
      try {
        await runFaceScan(file);
      } catch (err) {
        setMessage({ type: 'error', text: 'Live Scan failed' });
      }
    }
  };

  // --- Tag Face Handlers ---
  const handleOpenTagModal = async (img: GalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setTagSelectedUserId(null);
    setTagSelectedFaceIndex(null);
    setImageNaturalSize(null);
    setTagModalImage(img);
    try {
      const users = await fetchUsers();
      setAllUsers(users);
    } catch (err) {
      setAllUsers([]);
    }
  };

  const handleCloseTagModal = () => {
    setTagModalImage(null);
    setTagSelectedUserId(null);
    setTagSelectedFaceIndex(null);
    setImageNaturalSize(null);
  };

  const handleConfirmTag = async () => {
    if (!tagModalImage || !tagSelectedUserId) return;
    const itemId = typeof tagModalImage.id === 'string'
      ? parseInt(tagModalImage.id.replace('profile-', ''), 10)
      : tagModalImage.id;
    if (isNaN(itemId as number)) {
      setMessage({ type: 'error', text: 'Cannot tag a profile photo directly.' });
      handleCloseTagModal();
      return;
    }
    setTagging(true);
    try {
      const result = await tagFaceInPhoto(itemId as number, tagSelectedUserId, tagSelectedFaceIndex ?? undefined);
      handleCloseTagModal();
      setMessage({ type: 'success', text: result.message + (result.profilePictureSet ? ' Profile picture was set automatically!' : '') });
      setTimeout(() => setMessage(null), 5000);
      await loadGallery();
    } finally {
      setTagging(false);
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

  const handleRemoveTag = async (img: GalleryItem, userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemId = typeof img.id === 'string'
      ? parseInt(img.id.replace('profile-', ''), 10)
      : img.id;
    if (isNaN(itemId as number)) return;
    try {
      await untagFaceInPhoto(itemId as number, userId);
      // Update the tagModalImage locally so the UI reflects the removal instantly
      setTagModalImage((prev: GalleryItem | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          recognizedUsers: (prev.recognizedUsers || []).filter((u: any) => u.id !== userId),
        };
      });
      // Also reload the full gallery in background
      loadGallery();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove tag.' });
    }
  };

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '3rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {viewMode === 'personal' && loggedInUser ? 'Captured Moments' : 'Global Discovery'}
          </h2>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>
            {viewMode === 'personal' && loggedInUser
              ? `Smart gallery showing photos matched to ${loggedInUser.name}.`
              : 'Explore all community photos and identified profiles.'}
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

            <button
              onClick={() => handleRefreshRecognition(false)}
              className="btn btn-outline"
              disabled={refreshing}
              title="Quick re-scan (uses cached face data)"
              style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Scanning...' : 'AI Sync'}
            </button>

            <button
              onClick={() => handleRefreshRecognition(true)}
              className="btn btn-outline"
              disabled={refreshing}
              title="Force full re-scan — clears all caches and re-detects every face with the latest AI model"
              style={{
                padding: '0.75rem 1.25rem', borderRadius: '12px',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                borderColor: '#f59e0b', color: '#d97706'
              }}
            >
              <RotateCcw size={18} />
              Force Rescan
            </button>

            <button
              onClick={() => { setCameraMode('upload'); setShowCamera(true); }}
              className="btn btn-outline"
              style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
            >
              <Camera size={20} /> Capture Photo
            </button>
            <button
              onClick={() => { setCameraMode('identify'); setShowCamera(true); }}
              className="btn btn-primary"
              style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              <Camera size={20} /> Identity Check
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
                <h3 style={{ margin: 0, fontWeight: 700 }}>{cameraMode === 'identify' ? 'Identity Recognition' : 'Take a Snap'}</h3>
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
            {viewMode === 'personal'
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
                      {!img.isProfile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenTagModal(img, e); }}
                          title="Tag a person in this photo"
                          style={{
                            background: 'rgba(99,102,241,0.85)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            padding: '4px 9px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backdropFilter: 'blur(4px)'
                          }}
                        >
                          <Tag size={11} /> Tag
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

      {/* ===== TAG FACE MODAL ===== */}
      <AnimatePresence>
        {tagModalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(10,14,30,0.92)', backdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            }}
            onClick={handleCloseTagModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 100%)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '24px',
                padding: '2rem',
                width: '90%',
                maxWidth: '580px',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px -15px rgba(0,0,0,0.7)',
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '8px', background: 'rgba(99,102,241,0.2)', borderRadius: '10px' }}>
                    <UserCheck size={20} style={{ color: '#818cf8' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>Who is in this photo?</h3>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>Select a person to tag them</p>
                  </div>
                </div>
                <button onClick={handleCloseTagModal} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Photo Thumbnail — larger preview with interactive bounding boxes */}
              <div style={{ marginBottom: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', minHeight: '150px' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img 
                    ref={imgRef}
                    src={tagModalImage.url} 
                    alt="Photo to tag" 
                    onLoad={(e) => setImageNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }} 
                  />
                  {imageNaturalSize && tagModalImage.faces && tagModalImage.faces.length > 0 && tagModalImage.faces.map((face: any) => {
                     const x = face.box._x ?? face.box.x;
                     const y = face.box._y ?? face.box.y;
                     const w = face.box._width ?? face.box.width;
                     const h = face.box._height ?? face.box.height;
                     
                     const left = (x / imageNaturalSize.w) * 100;
                     const top = (y / imageNaturalSize.h) * 100;
                     const width = (w / imageNaturalSize.w) * 100;
                     const height = (h / imageNaturalSize.h) * 100;
                     
                     const isSelected = tagSelectedFaceIndex === face.index;
                     const hasTag = face.manuallyTaggedUserId !== undefined && face.manuallyTaggedUserId !== null;
                     
                     return (
                        <div
                          key={face.index}
                          onClick={() => setTagSelectedFaceIndex(isSelected ? null : face.index)}
                          title={hasTag ? "Already tagged explicitly" : "Click to tag this exact face"}
                          style={{
                            position: 'absolute',
                            left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                            border: isSelected ? '3px solid #6366f1' : hasTag ? '2px solid rgba(255,255,255,0.3)' : '2px dashed #f59e0b',
                            background: isSelected ? 'rgba(99,102,241,0.25)' : 'transparent',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 0 0 9999px rgba(0,0,0,0.4)' : 'none',
                            zIndex: isSelected ? 10 : 1
                          }}
                        />
                     );
                  })}
                  {(!tagModalImage.faces || tagModalImage.faces.length === 0) && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '16px', color: 'white', fontWeight: 600, flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>⚠️ AI Could Not Detect Any Faces</span>
                      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>This image format might be unsupported or faces are too blurry.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Already Tagged — with × remove button to fix wrong AI tags */}
              {tagModalImage.recognizedUsers && tagModalImage.recognizedUsers.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tagged People <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, textTransform: 'none' }}>— click × to remove wrong tag</span></p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {tagModalImage.recognizedUsers.map((u: any) => (
                      <span
                        key={u.id}
                        style={{
                          background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.35)',
                          borderRadius: '999px',
                          padding: '4px 6px 4px 12px',
                          fontSize: '0.8rem',
                          color: '#a5b4fc',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        ✓ {u.name}
                        <button
                          onClick={(e) => handleRemoveTag(tagModalImage, u.id, e)}
                          title={`Remove ${u.name} from this photo`}
                          style={{
                            background: 'rgba(239,68,68,0.25)',
                            border: '1px solid rgba(239,68,68,0.4)',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            flexShrink: 0,
                          }}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User Selection Grid */}
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select a Person</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {allUsers.map((user: any) => {
                  const isSelected = tagSelectedUserId === user.id;
                  const alreadyTagged = tagModalImage.recognizedUsers?.some((u: any) => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      disabled={alreadyTagged}
                      onClick={() => setTagSelectedUserId(isSelected ? null : user.id)}
                      style={{
                        background: isSelected ? 'rgba(99,102,241,0.3)' : alreadyTagged ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                        border: isSelected ? '2px solid #6366f1' : alreadyTagged ? '2px solid rgba(99,102,241,0.2)' : '2px solid rgba(255,255,255,0.08)',
                        borderRadius: '16px',
                        padding: '1rem 0.75rem',
                        cursor: alreadyTagged ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease',
                        opacity: alreadyTagged ? 0.45 : 1,
                      }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: isSelected ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
                        <img
                          src={user.profilePicture || user['profile picture'] || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff&bold=true`}
                          alt={user.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <span style={{ color: isSelected ? '#c7d2fe' : 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', wordBreak: 'break-word' }}>
                        {user.name.split(' ')[0]}
                        {alreadyTagged && <span style={{ display: 'block', fontSize: '0.6rem', color: '#818cf8' }}>✓ tagged</span>}
                      </span>
                      {isSelected && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                          <CheckCircle2 size={14} style={{ color: '#818cf8' }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={handleCloseTagModal} style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                  Cancel
                </button>
                <button
                  onClick={handleConfirmTag}
                  disabled={!tagSelectedUserId || tagging}
                  style={{
                    padding: '0.6rem 1.6rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: tagSelectedUserId && !tagging ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(99,102,241,0.3)',
                    color: 'white',
                    fontWeight: 700,
                    cursor: tagSelectedUserId && !tagging ? 'pointer' : 'not-allowed',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tagging ? (
                    <><div className="loading-spinner" style={{ width: '14px', height: '14px', borderTopColor: 'white', borderWidth: '2px' }} /> Tagging...</>
                  ) : (
                    <><Tag size={15} /> Confirm Tag</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 2001 }}>
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
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'white', opacity: 0.4, fontStyle: 'italic' }}>No faces identified yet</span>
                  )}
                </div>
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
