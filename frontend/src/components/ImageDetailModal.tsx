import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, RefreshCw, Trash2, Eye, Info, MapPin, 
  Calendar, Users, Box, FileText, Hash, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { 
  updateCustomMetadata, setGalleryItemHashtags, deleteGalleryItem, 
  untagFaceInPhoto, forceScanItem 
} from '../services/galleryService';

interface ImageDetailModalProps {
  selectedImage: any;
  onClose: () => void;
  loggedInUser: any;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onImageUpdated?: (updated: any) => void;
  onImageDeleted?: (deletedId: number | string) => void;
}

export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  selectedImage,
  onClose,
  loggedInUser,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onImageUpdated,
  onImageDeleted
}) => {
  const [editingHashtags, setEditingHashtags] = useState(false);
  const [hashtagsDraft, setHashtagsDraft] = useState('');
  const [savingHashtags, setSavingHashtags] = useState(false);

  const [editingCustomMetadata, setEditingCustomMetadata] = useState(false);
  const [customLocationDraft, setCustomLocationDraft] = useState('');
  const [customEventDraft, setCustomEventDraft] = useState('');
  const [scenesDraft, setScenesDraft] = useState('');
  const [objectsDraft, setObjectsDraft] = useState('');
  const [ocrTextDraft, setOcrTextDraft] = useState('');
  const [savingCustomMetadata, setSavingCustomMetadata] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const itemId = useMemo(() => {
    if (!selectedImage) return null;
    return typeof selectedImage.id === 'string'
      ? parseInt(selectedImage.id.replace('profile-', ''), 10)
      : Number(selectedImage.id);
  }, [selectedImage]);

  // Sync local editing states when image changes
  useEffect(() => {
    if (!selectedImage) return;
    const meta = selectedImage.metadata || {};
    
    const tagsArr = Array.isArray(selectedImage.hashtags)
      ? selectedImage.hashtags.map((t: any) => typeof t === 'string' ? t : t.name)
      : [];
    
    setHashtagsDraft(tagsArr.map((t: string) => `#${t}`).join(' '));
    setCustomLocationDraft(meta.location ?? meta.customLocation ?? '');
    setCustomEventDraft(meta.eventName ?? meta.customEvent ?? '');
    
    const scenes = meta.scenes || selectedImage.sceneTags || [];
    setScenesDraft(scenes.map((s: any) => typeof s === 'string' ? s : (s.label || s.name || '')).filter(Boolean).join(', '));
    
    const objs = meta.objects || selectedImage.objectTags || [];
    setObjectsDraft(objs.map((o: any) => typeof o === 'string' ? o : (o.name || '')).filter(Boolean).join(', '));
    
    const ocrs = meta.ocrText || selectedImage.ocrText || [];
    setOcrTextDraft(ocrs.map((t: any) => String(t || '')).filter(Boolean).join(', '));

    setEditingHashtags(false);
    setEditingCustomMetadata(false);
  }, [selectedImage]);

  if (!selectedImage) return null;

  const showNotification = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleStartEditingMetadata = () => {
    setEditingCustomMetadata(true);
  };

  const handleSaveCustomMetadata = async () => {
    if (!itemId || isNaN(itemId)) return;
    setSavingCustomMetadata(true);
    try {
      const scenesArray = scenesDraft.split(',').map(s => s.trim()).filter(Boolean);
      const objectsArray = objectsDraft.split(',').map(o => o.trim()).filter(Boolean);
      const ocrTextArray = ocrTextDraft.split(',').map(t => t.trim()).filter(Boolean);

      const updatePayload = {
        customLocation: customLocationDraft.trim(),
        customEvent: customEventDraft.trim(),
        location: customLocationDraft.trim(),
        eventName: customEventDraft.trim(),
        scenes: scenesArray,
        objects: objectsArray,
        ocrText: ocrTextArray,
      };

      const parsedHashtags = hashtagsDraft
        .split(/[\s,]+/)
        .map(t => t.trim().replace(/^#+/, ''))
        .filter(t => t.length > 0);

      const [metaResult, tagsResult] = await Promise.all([
        updateCustomMetadata(itemId, updatePayload),
        setGalleryItemHashtags(itemId, parsedHashtags)
      ]);

      const updatedMeta = metaResult?.metadata || {};
      const updatedHashtags = Array.isArray(tagsResult?.hashtags) ? tagsResult.hashtags : (metaResult?.hashtags || []);

      const fullyUpdatedItem = {
        ...selectedImage,
        metadata: { ...selectedImage.metadata, ...updatedMeta },
        hashtags: updatedHashtags
      };

      if (onImageUpdated) onImageUpdated(fullyUpdatedItem);
      setEditingCustomMetadata(false);
      showNotification('success', 'Metadata updated successfully.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save overrides.');
    } finally {
      setSavingCustomMetadata(false);
    }
  };

  const handleSaveHashtagsOnly = async () => {
    if (!itemId || isNaN(itemId)) return;
    setSavingHashtags(true);
    try {
      const parsed = hashtagsDraft
        .split(/[\s,]+/)
        .map(t => t.trim().replace(/^#+/, ''))
        .filter(t => t.length > 0);

      const res = await setGalleryItemHashtags(itemId, parsed);
      const updatedHashtags = Array.isArray(res?.hashtags) ? res.hashtags : [];

      const fullyUpdatedItem = {
        ...selectedImage,
        hashtags: updatedHashtags
      };

      if (onImageUpdated) onImageUpdated(fullyUpdatedItem);
      setEditingHashtags(false);
      showNotification('success', 'Hashtags updated successfully.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update hashtags.');
    } finally {
      setSavingHashtags(false);
    }
  };

  const handleRescan = async () => {
    if (!itemId || isNaN(itemId)) return;
    setRefreshing(true);
    try {
      await forceScanItem(itemId);
      showNotification('info', 'Re-scan triggered in background. Please wait a moment.');
    } catch (err: any) {
      showNotification('error', 'Failed to trigger AI re-scan.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!itemId || isNaN(itemId)) return;
    const confirmed = window.confirm('Delete this photo permanently? This cannot be undone.');
    if (!confirmed) return;
    
    setDeleting(true);
    try {
      await deleteGalleryItem(itemId);
      if (onImageDeleted) onImageDeleted(selectedImage.id);
      showNotification('success', 'Photo deleted.');
      onClose();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete photo.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUntag = async (userId: number, userName: string) => {
    if (!itemId || isNaN(itemId)) return;
    const confirmed = window.confirm(`Remove ${userName} from this photo? AI will not re-tag them.`);
    if (!confirmed) return;

    try {
      await untagFaceInPhoto(itemId, userId);
      
      // Construct updated item with filtered recognized users
      const currentUsers = selectedImage.recognizedUsers || [];
      const nextUsers = currentUsers.filter((u: any) => u.id !== userId);
      
      const fullyUpdatedItem = {
        ...selectedImage,
        recognizedUsers: nextUsers
      };

      if (onImageUpdated) onImageUpdated(fullyUpdatedItem);
      showNotification('success', `${userName} untagged.`);
    } catch (err: any) {
      showNotification('error', 'Failed to untag user.');
    }
  };

  // Normalize nested values for rendering
  const meta = (selectedImage.metadata || {}) as any;
  const rawObjects = meta.objects || selectedImage.objectTags || [];
  const rawScenes = meta.scenes || selectedImage.sceneTags || [];
  const rawOcr = meta.ocrText || selectedImage.ocrText || [];
  
  const rawTags = Array.isArray(selectedImage.hashtags)
    ? selectedImage.hashtags.map((t: any) => typeof t === 'string' ? t : (t.name || ''))
    : [];

  const personCount = meta.peopleCount ?? meta.personCount ?? selectedImage.recognizedUsers?.length ?? 0;
  const dominantColor = meta.dominantColor ?? meta.dominant_color ?? null;
  const aspectRatio = meta.aspectRatio ?? meta.aspect_ratio ?? null;

  const eventName = meta.eventName ?? meta.customEvent ?? '';
  const location = meta.location ?? meta.customLocation ?? '';

  const cleanObjects = Array.from(new Set(rawObjects.map((o: any) => {
    const name = typeof o === 'string' ? o : (o.name || '');
    return name.trim().toLowerCase();
  }).filter(Boolean))) as string[];

  const cleanScenes = Array.from(new Set(rawScenes.map((s: any) => {
    const label = typeof s === 'string' ? s : (s.label || s.name || '');
    return label.trim().toLowerCase();
  }).filter(Boolean))) as string[];

  const cleanOcr = Array.from(new Set(rawOcr.map((t: any) => String(t || '').trim()).filter((t: any) => t.length > 1))) as string[];
  const cleanHashtags = Array.from(new Set(rawTags.map((t: any) => String(t || '').trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean))) as string[];

  const isEdited = Boolean(meta.metadataEditedByUser);

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
          padding: '6rem 2rem 4rem', overflowY: 'auto', zIndex: 2000,
        }}
        onClick={onClose}
      >
        {/* Main Modal Container */}
        <motion.div
          key={selectedImage.url}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{
            width: 'min(1200px, 95vw)',
            height: 'auto',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(24px)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15, 23, 42, 0.4)'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', fontWeight: 600 }}>
              Photo Details
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {!selectedImage.isProfile && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRescan(); }}
                    disabled={refreshing}
                    title="Refresh AI"
                    style={{
                      width: '40px', height: '40px', padding: '0', borderRadius: '12px',
                      background: refreshing ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.85)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white', cursor: refreshing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !refreshing && (e.currentTarget.style.background = 'rgba(139, 92, 246, 1)')}
                    onMouseLeave={(e) => !refreshing && (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.85)')}
                  >
                    <RefreshCw size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    disabled={deleting}
                    title="Delete Photo"
                    style={{
                      width: '40px', height: '40px', padding: '0', borderRadius: '12px',
                      background: deleting ? 'rgba(220, 38, 38, 0.4)' : 'rgba(220, 38, 38, 0.85)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white', cursor: deleting ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !deleting && (e.currentTarget.style.background = 'rgba(239, 68, 68, 1)')}
                    onMouseLeave={(e) => !deleting && (e.currentTarget.style.background = 'rgba(220, 38, 38, 0.85)')}
                  >
                    {deleting ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <Trash2 size={18} />}
                  </button>
                </>
              )}
              <button 
                onClick={onClose} 
                title="Close"
                style={{ 
                  width: '40px', height: '40px', padding: '0', borderRadius: '12px', 
                  background: 'rgba(30, 41, 59, 0.85)', border: '1px solid rgba(255,255,255,0.15)', 
                  color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(51, 65, 85, 1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.85)'}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth > 992 ? '55% 45%' : '1fr',
            flex: 1,
            overflow: 'hidden',
          }}>
            {/* Image Area */}
            <div style={{ 
              position: 'relative', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '1.5rem',
              background: 'rgba(0,0,0,0.2)',
              borderRight: window.innerWidth > 992 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              borderBottom: window.innerWidth <= 992 ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
              {onPrev && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPrev(); }}
                  disabled={!hasPrev}
                  title={hasPrev ? "Previous Photo" : "No Previous Photo"}
                  style={{ 
                    position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
                    width: '42px', height: '42px', padding: '0', borderRadius: '50%', 
                    background: 'rgba(15, 23, 42, 0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
                    cursor: hasPrev ? 'pointer' : 'default', opacity: hasPrev ? 1 : 0.3, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', backdropFilter: 'blur(4px)'
                  }}
                  onMouseEnter={(e) => hasPrev && (e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)', e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)')}
                  onMouseLeave={(e) => hasPrev && (e.currentTarget.style.transform = 'translateY(-50%) scale(1)', e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)')}
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              <img
                src={selectedImage.url}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(90vh - 120px)',
                  borderRadius: '18px',
                  objectFit: 'contain',
                  boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
                }}
              />

              {onNext && (
                <button
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  disabled={!hasNext}
                  title={hasNext ? "Next Photo" : "No Next Photo"}
                  style={{ 
                    position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
                    width: '42px', height: '42px', padding: '0', borderRadius: '50%', 
                    background: 'rgba(15, 23, 42, 0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
                    cursor: hasNext ? 'pointer' : 'default', opacity: hasNext ? 1 : 0.3, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', backdropFilter: 'blur(4px)'
                  }}
                  onMouseEnter={(e) => hasNext && (e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)', e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)')}
                  onMouseLeave={(e) => hasNext && (e.currentTarget.style.transform = 'translateY(-50%) scale(1)', e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)')}
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Right Metadata Panel */}
            <div className="custom-scrollbar" style={{ 
              padding: '1.5rem 2rem', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem',
              maxHeight: window.innerWidth > 992 ? 'calc(90vh - 75px)' : '45vh'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.25px' }}>
                  Image Intelligence
                </div>
                {isEdited && (
                  <span style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.4)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Edited
                  </span>
                )}
              </div>
              {loggedInUser && !selectedImage.isProfile && !editingCustomMetadata && (
                <button onClick={handleStartEditingMetadata} style={{
                  padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <Info size={14} /> Edit
                </button>
              )}
            </div>

            {!editingCustomMetadata ? (
              <>
                {/* 1. People Found */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px', padding: '1.25rem'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={16} style={{ color: 'rgba(99,102,241,0.8)' }} /> People Detected
                  </div>

                  {(selectedImage.scanStatus !== 'completed' && selectedImage.scanStatus !== 'failed') ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem' }}>
                      <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px', borderTopColor: '#6366f1' }}></div>
                      <span style={{ color: '#a5b4fc', fontWeight: 600, fontSize: '0.85rem' }}>Running face detection...</span>
                    </div>
                  ) : selectedImage.recognizedUsers && selectedImage.recognizedUsers.length > 0 ? (
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {selectedImage.recognizedUsers.map((u: any) => (
                        <div key={u.id} style={{
                          background: 'rgba(255, 255, 255, 0.08)', padding: '4px 10px 4px 4px',
                          borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, color: '#ffffff',
                          display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(255, 255, 255, 0.2)' }}>
                            <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6366f1&color=fff`} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          {u.name}
                          {!selectedImage.isProfile && (
                            <button onClick={(e) => { e.stopPropagation(); handleUntag(u.id, u.name); }}
                              style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem', fontStyle: 'italic' }}>No recognized individuals found.</span>
                  )}
                </div>

                {/* 2. Metrics Grid */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)', padding: '1rem 1.25rem',
                  borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'center'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Count</div>
                    <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                      {personCount} {personCount === 1 ? 'Person' : 'People'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Ratio</div>
                    <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>
                      {aspectRatio ? `${Number(aspectRatio).toFixed(2)}:1` : 'N/A'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Tone</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      {dominantColor ? (
                        <>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: dominantColor, border: '1px solid rgba(255,255,255,0.4)' }} />
                          <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>{dominantColor}</span>
                        </>
                      ) : (
                        <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9rem' }}>N/A</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Event & Location Context */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem',
                  borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Calendar size={18} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                    <div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Event</div>
                      <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>
                        {eventName || <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic', fontWeight: 400 }}>Unspecified</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '1rem' }}>
                    <MapPin size={18} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                    <div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
                      <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>
                        {location || <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic', fontWeight: 400 }}>Unspecified</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Detail Matrices */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)', padding: '1.25rem',
                  borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Eye size={15} style={{ color: '#10b981' }} /> Scenes Detected
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {cleanScenes.length > 0 ? cleanScenes.map((s, i) => (
                        <span key={i} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#ffffff', textTransform: 'capitalize' }}>{s}</span>
                      )) : <span style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: '0.8rem' }}>No environment profiles found.</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Box size={15} style={{ color: '#8b5cf6' }} /> Objects Matrix
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {cleanObjects.length > 0 ? cleanObjects.map((o, i) => (
                        <span key={i} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#ffffff', textTransform: 'capitalize' }}>{o}</span>
                      )) : <span style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: '0.8rem' }}>No visual objects identified.</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={15} style={{ color: '#f59e0b' }} /> Text Recognized (OCR)
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {cleanOcr.length > 0 ? cleanOcr.map((t, i) => (
                        <span key={i} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#ffffff' }}>"{t}"</span>
                      )) : <span style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: '0.8rem' }}>No textual data extracted.</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Hash size={15} style={{ color: 'rgba(255,255,255,0.5)' }} /> Hashtag Keywords
                      </div>
                      {loggedInUser && !selectedImage.isProfile && !editingHashtags && (
                        <button onClick={() => setEditingHashtags(true)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                      )}
                    </div>

                    {!editingHashtags ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {cleanHashtags.length > 0 ? cleanHashtags.map((t, i) => (
                          <span key={i} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', color: '#ffffff', fontWeight: 600 }}>#{t}</span>
                        )) : <span style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: '0.8rem' }}>No active tags attached.</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input value={hashtagsDraft} onChange={(e) => setHashtagsDraft(e.target.value)} placeholder="#nature #group"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '0.85rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button onClick={() => { setEditingHashtags(false); }}
                            style={{ padding: '4px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                          <button onClick={handleSaveHashtagsOnly} disabled={savingHashtags}
                            style={{ padding: '4px 14px', borderRadius: 6, background: '#6366f1', border: 'none', color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Edit Metadata Form */
              <div style={{
                display: 'flex', flexDirection: 'column', gap: '1.25rem',
                background: 'rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(30px)',
                padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Name</label>
                    <input
                      value={customEventDraft}
                      onChange={(e) => setCustomEventDraft(e.target.value)}
                      placeholder="e.g. Office Summit"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</label>
                    <input
                      value={customLocationDraft}
                      onChange={(e) => setCustomLocationDraft(e.target.value)}
                      placeholder="e.g. Executive Center"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scenes Detected (comma-separated)</label>
                  <input
                    value={scenesDraft}
                    onChange={(e) => setScenesDraft(e.target.value)}
                    placeholder="indoor, corporate, meeting"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Objects Matrix (comma-separated)</label>
                  <input
                    value={objectsDraft}
                    onChange={(e) => setObjectsDraft(e.target.value)}
                    placeholder="laptop, chair, desk"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Text Mappings / OCR (comma-separated)</label>
                  <input
                    value={ocrTextDraft}
                    onChange={(e) => setOcrTextDraft(e.target.value)}
                    placeholder="Roadmap, Vision"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hashtags Context (comma or space separated)</label>
                  <input
                    value={hashtagsDraft}
                    onChange={(e) => setHashtagsDraft(e.target.value)}
                    placeholder="#meeting, corporate"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                  <button
                    onClick={() => setEditingCustomMetadata(false)}
                    style={{ padding: '10px 20px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSaveCustomMetadata}
                    disabled={savingCustomMetadata}
                    style={{ padding: '10px 24px', borderRadius: 12, background: 'rgba(99,102,241,0.9)', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {savingCustomMetadata ? <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : 'Save Overrides'}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Notifications Popup */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{
              position: 'fixed', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)',
              zIndex: 9999, minWidth: '300px', display: 'flex', alignItems: 'center',
              gap: '0.75rem', padding: '1rem 2rem', borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              backgroundColor: message.type === 'error' ? '#ff4444' : message.type === 'info' ? '#6366f1' : '#10b981',
              color: 'white', fontWeight: 600, fontSize: '0.9rem'
            }}
          >
            {message.type === 'error' ? <AlertCircle size={20} /> : message.type === 'info' ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <CheckCircle2 size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
