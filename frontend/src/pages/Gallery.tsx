import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraCapture from '../components/CameraCapture';
import { fetchGallery, uploadGallery } from '../services/galleryService';
import { identifyFace } from '../services/faceService';

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
}

interface GalleryProps {
  loggedInUser: UserProfile | null;
}

const Gallery: React.FC<GalleryProps> = ({ loggedInUser }) => {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [matchedUsers, setMatchedUsers] = useState<any[] | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'upload' | 'identify'>('upload');
  const loggedInUserId = loggedInUser ? Number(loggedInUser.originalId ?? loggedInUser.id) : null;

  useEffect(() => {
    loadGallery();
  }, [loggedInUserId]);

  const loadGallery = async () => {
    try {
      const data = await fetchGallery(loggedInUserId || undefined);
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
      const updatedGallery = await uploadGallery(formData, loggedInUserId || undefined);
      setImages(updatedGallery);
      setMessage({ type: 'success', text: 'Successfully added to the gallery!' });
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
    if (cameraMode === 'upload') {
      await uploadImages([file]);
    } else {
      setMessage({ type: 'info', text: 'Analyzing live face...' });
      try {
        await runFaceScan(file);
      } catch (err) {
        setMessage({ type: 'error', text: 'AI Live Scan failed' });
      }
    }

    setShowCamera(false);
  };

  if (loading) return <div className="text-center p-10">Loading gallery...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-10" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            {loggedInUser ? `${loggedInUser.name}'s Gallery` : 'Global Gallery'}
          </h2>
          <p className="text-muted">
            {loggedInUser
              ? 'Showing all photos securely matched to your identity via AI.'
              : 'Explore user profiles and shared gallery photos. Log in to filter your photos.'}
          </p>
        </div>
        {!showCamera && (
          <div className="flex gap-4" style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => { setCameraMode('identify'); setShowCamera(true); }}
              className="btn btn-primary"
              style={{ padding: '1rem 2rem', background: '#ec4899', borderColor: '#ec4899' }}
            >
              <Camera size={20} /> Live Verification
            </button>
            <button
              onClick={() => { setCameraMode('upload'); setShowCamera(true); }}
              className="btn btn-outline"
              style={{ padding: '1rem 2rem' }}
            >
              <Camera size={20} /> Use Camera
            </button>
            <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '1rem 2rem', margin: 0 }}>
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
        )}
      </div>

      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card mb-8"
            style={{ maxWidth: '600px', margin: '0 auto 2rem' }}
          >
            <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{cameraMode === 'identify' ? 'Look at Camera to Verify' : 'Take a Photo'}</h3>
              <button onClick={() => setShowCamera(false)} className="btn btn-danger" style={{ padding: '5px' }}>
                <X size={20} />
              </button>
            </div>
            <CameraCapture onCapture={handleCameraCapture} onCancel={() => setShowCamera(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {uploading && (
        <div className="card text-center mb-8" style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px dashed var(--primary)' }}>
          <span className="loading-spinner" style={{ borderTopColor: 'var(--primary)' }}></span>
          <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Processing images...</p>
        </div>
      )}

      {images.length === 0 ? (
        <div className="card text-center p-20" style={{ border: '2px dashed var(--border-color)', background: 'transparent' }}>
          <ImageIcon size={64} className="text-muted" style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
          <p className="text-muted" style={{ fontSize: '1.125rem' }}>The gallery is currently empty.</p>
        </div>
      ) : (
        <div className="gallery-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          <AnimatePresence>
            {images.map((img, index) => (
                <motion.div
                  key={img.id || index}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -5 }}
                  className="gallery-item"
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow)',
                    background: 'white',
                  }}
                >
                  <img
                    src={img.url}
                    alt={`Gallery ${index}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  <div className="gallery-info" style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    padding: '1rem',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                    color: 'white',
                    fontSize: '0.875rem',
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}>
                    <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{img.label || 'Shared Photo'}</span>
                      {img.isProfile && (
                        <span style={{
                          background: 'var(--primary)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                        }}>USER</span>
                      )}
                    </div>
                    {img.recognizedUsers?.length! > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem', color: '#f3f4f6' }}>
                        <span style={{ opacity: 0.9 }}>Recognized:</span>
                        {img.recognizedUsers?.map((user) => (
                          <span key={user.id} style={{ background: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                            {user.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleScanFace(img.url); }}
                      className="btn btn-primary"
                      style={{ fontSize: '0.7rem', padding: '5px' }}
                    >
                      <Camera size={12} /> AI Scan Face
                    </button>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      )}

      {message && (
        <div className="message-toast" style={{ backgroundColor: message.type === 'error' ? 'var(--error)' : 'var(--success)' }}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {message.text}
        </div>
      )}

      <AnimatePresence>
        {matchedUsers && matchedUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}
            onClick={() => setMatchedUsers(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="card"
              style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', padding: '2.5rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', background: 'var(--primary)', color: 'white', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  <CheckCircle2 size={16} style={{ marginRight: '0.5rem' }} /> Identity Verified ({matchedUsers.length})
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: matchedUsers.length > 1 ? '1fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {matchedUsers.map((user: any) => (
                  <div key={user.id} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '120px', height: '120px', margin: '0 auto 1rem', borderRadius: '50%', padding: '4px', background: 'linear-gradient(45deg, var(--primary), var(--secondary))' }}>
                      <img
                        src={user.profilePicture || user['profile picture']}
                        alt={user.name}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--surface)' }}
                      />
                    </div>

                    <h3 style={{ fontSize: '1.4rem', marginBottom: '0.2rem', margin: 0, color: 'var(--text)' }}>
                      {user.name}
                    </h3>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      {user.email}
                    </p>

                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '8px', display: 'inline-block' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                        AI Confidence: {(user.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-outline w-full" style={{ width: '100%' }} onClick={() => setMatchedUsers(null)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
