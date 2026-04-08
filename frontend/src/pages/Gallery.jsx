import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraCapture from '../components/CameraCapture';

const Gallery = () => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/gallery');
      const data = await res.json();
      setImages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImages = async (files) => {
    setUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('gallery', file));

    try {
      const res = await fetch('http://localhost:4000/api/gallery', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload images');
      
      const updatedGallery = await res.json();
      setImages(updatedGallery);
      setMessage({ type: 'success', text: `Successfully added to the gallery!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleMultipleUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) uploadImages(files);
  };

  const handleScanFace = async (imgUrl) => {
    setMessage({ type: 'info', text: 'AI is scanning face... please wait' });
    
    try {
      // 1. Download image blob from URL
      const imageRes = await fetch(imgUrl);
      const blob = await imageRes.blob();
      const file = new File([blob], "scan.jpg", { type: "image/jpeg" });

      // 2. Send to Identify API
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('http://localhost:4000/api/identify', {
        method: 'POST',
        body: formData
      });
      
      const result = await res.json();
      if (result.userName) {
        setMessage({ type: 'success', text: `AI Match Found: This is ${result.userName} (${(result.confidence * 100).toFixed(0)}%)` });
      } else {
        setMessage({ type: 'error', text: result.message || 'Unknown User' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'AI Scan failed' });
    }
  };

  const handleCameraCapture = (file) => {
    uploadImages([file]);
    setShowCamera(false);
  };

  if (loading) return <div className="text-center p-10">Loading gallery...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-10" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Global Gallery</h2>
          <p className="text-muted">Explore user profiles and shared gallery photos.</p>
        </div>
        {!showCamera && (
          <div className="flex gap-4" style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => setShowCamera(true)}
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
              <h3 style={{ margin: 0 }}>Take a Photo</h3>
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
          gap: '1.5rem' 
        }}>
          <AnimatePresence>
            {images.map((img, index) => (
              <motion.div 
                key={index}
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
                  background: 'white'
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
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{img.label || 'Shared Photo'}</span>
                    {img.isProfile && (
                      <span style={{ 
                        background: 'var(--primary)', 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 'bold'
                      }}>USER</span>
                    )}
                  </div>
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

      <style>{`
        .gallery-item:hover .gallery-info {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default Gallery;
