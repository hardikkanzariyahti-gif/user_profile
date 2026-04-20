import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserCircle, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchSharedAlbum } from '../services/albumService';

const SharedAlbum: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => {
    if (shareId) {
      loadSharedAlbum(shareId);
    }
  }, [shareId]);

  const loadSharedAlbum = async (id: string) => {
    try {
      const data = await fetchSharedAlbum(id);
      setAlbum(data);
    } catch (err) {
      console.error('Failed to load shared album', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}><div className="loading-spinner" /></div>;
  
  if (!album) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.2rem', opacity: 0.7, marginBottom: '2rem' }}>This shared album link is invalid or has been removed.</p>
      <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>Go to Home</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white' }}>
      {/* Mini Public Header */}
      <header style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <UserCircle size={32} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>ProProfile <span style={{ fontWeight: 400, opacity: 0.5 }}>Shared</span></span>
        </div>
      </header>

      <main style={{ padding: '4rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.03em' }}>{album.title}</h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            Shared by <strong>{album.user.name}</strong> • {album.items.length} {album.items.length === 1 ? 'Photo' : 'Photos'}
          </p>
          {album.description && <p style={{ marginTop: '2rem', fontSize: '1.2rem', maxWidth: '800px', margin: '2rem auto 0', opacity: 0.8, lineHeight: 1.6 }}>{album.description}</p>}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: '1.5rem',
        }}>
          {album.items.map((item: any, idx: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedImage(item)}
              style={{ 
                borderRadius: '24px', 
                overflow: 'hidden', 
                aspectRatio: '4/5', 
                cursor: 'pointer',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
              }}
            >
              <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </motion.div>
          ))}
        </div>
      </main>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)' }}
            onClick={() => setSelectedImage(null)}
          >
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', display: 'flex', gap: '1rem' }}>
                <a href={selectedImage.url} download onClick={e => e.stopPropagation()} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%', border: 'none' }}>
                    <Download size={32} />
                </a>
                <button onClick={() => setSelectedImage(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '12px', borderRadius: '50%', cursor: 'pointer' }}><X size={32} /></button>
            </div>
            <img src={selectedImage.url} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 0 100px rgba(0,0,0,1)' }} />
          </motion.div>
        )}
      </AnimatePresence>

      <footer style={{ padding: '6rem 2rem', textAlign: 'center', opacity: 0.3, fontSize: '0.9rem' }}>
        &copy; 2026 ProProfile Shared Services. All rights reserved.
      </footer>
    </div>
  );
};

export default SharedAlbum;
