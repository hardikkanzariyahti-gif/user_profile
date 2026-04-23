import React, { useEffect, useMemo, useState } from 'react';
import { Combine, X, Eye, EyeOff, UserPlus, Trash2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { API_BASE_URL } from '../services/apiClient';
import FaceCrop from '../components/FaceCrop';
import { fetchGalleryItem, setProfilePictureFromGalleryItem } from '../services/galleryService';

const API_BASE = `${API_BASE_URL}/api`;

interface FaceCluster {
  clusterId: string;
  faceCount: number;
  anchorImage: string;
  anchorBox: any;
  relatedPhotos: { itemId: number; faceIndex: number; url: string; box?: any }[];
}

export default function People() {
  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [selectedCluster, setSelectedCluster] = useState<FaceCluster | null>(null);
  const [merging, setMerging] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState<{ itemId: number; faceIndex: number }[]>([]);
  const [photoDetailsById, setPhotoDetailsById] = useState<Record<number, any>>({});
  const [showAllFaces, setShowAllFaces] = useState(false);
  const [activeMenuFace, setActiveMenuFace] = useState<{ itemId: number; faceIndex: number } | null>(null);

  const [preview, setPreview] = useState<{
    open: boolean;
    itemId: number | null;
    boxes: any[];
    item: any | null;
    loading: boolean;
    error: string | null;
  }>({ open: false, itemId: null, boxes: [], item: null, loading: false, error: null });
  const [previewNaturalSize, setPreviewNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const maybeOfferProfilePictureFallback = async (userId: number, galleryItemId: number, freshUsers?: any[]) => {
    const userList = freshUsers || users;
    const selectedUser = userList.find((u) => Number(u.id) === Number(userId));
    if (!selectedUser || selectedUser.profilePicture) return;

    const shouldUseAsProfile = window.confirm(
      `This user does not have a profile picture yet.\n\nUse this selected photo as their profile picture?`
    );
    if (!shouldUseAsProfile) return;

    try {
      const result = await setProfilePictureFromGalleryItem(galleryItemId, userId);
      setMessage({ type: 'success', text: result.message || 'Profile picture set successfully.' });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to set profile picture.' });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clustersRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/gallery/clusters`),
        fetch(`${API_BASE}/users`)
      ]);
      const clustersJson = await clustersRes.json().catch(() => null);
      const usersJson = await usersRes.json().catch(() => null);
      if (!clustersRes.ok) throw new Error(clustersJson?.error || 'Failed to load unknown people clusters.');
      if (!usersRes.ok) throw new Error(usersJson?.error || 'Failed to load users.');
      
      const newUsers = Array.isArray(usersJson) ? usersJson : [];
      setClusters(Array.isArray(clustersJson) ? clustersJson : []);
      setUsers(newUsers);
      return { clusters: Array.isArray(clustersJson) ? clustersJson : [], users: newUsers };
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load people data.' });
      return { clusters: [], users: [] };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!selectedCluster) {
      setSelectedFaces([]);
      setShowAllFaces(false);
      return;
    }
    // DEFAULT: Only select the primary (anchor) face to prevent accidental bulk-ignoring of the whole cluster
    setSelectedFaces([{ itemId: selectedCluster.relatedPhotos[0].itemId, faceIndex: selectedCluster.relatedPhotos[0].faceIndex }]);
  }, [selectedCluster]);

  useEffect(() => {
    if (!selectedCluster) return;

    const uniqueItemIds = Array.from(new Set(selectedCluster.relatedPhotos.map(p => p.itemId)));
    const itemIdsToFetch = uniqueItemIds.slice(0, 24).filter((id) => !photoDetailsById[id]);

    if (itemIdsToFetch.length === 0) return;

    itemIdsToFetch.forEach(async (id) => {
      try {
        const data = await fetchGalleryItem(id);
        setPhotoDetailsById(prev => ({ ...prev, [id]: data }));
      } catch { }
    });
  }, [selectedCluster]);

  const toggleFace = (face: { itemId: number; faceIndex: number }) => {
    setSelectedFaces(prev => {
      const exists = prev.some(f => f.itemId === face.itemId && f.faceIndex === face.faceIndex);
      if (exists) return prev.filter(f => !(f.itemId === face.itemId && f.faceIndex === face.faceIndex));
      return [...prev, face];
    });
  };

  const handleMerge = async (userId: number) => {
    if (!selectedCluster) return;
    if (selectedFaces.length === 0) {
      setMessage({ type: 'info', text: 'Select at least one face to tag.' });
      return;
    }
    setMerging(true);
    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, faces: selectedFaces })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: `Success! Tagged ${selectedFaces.length} photos. AI is now auto-scanning the rest...` });
      const freshData = await fetchData();
      await maybeOfferProfilePictureFallback(userId, selectedFaces[0].itemId, freshData.users);
      setSelectedCluster(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Merge failed.' });
    } finally {
      setMerging(false);
    }
  };

  const handleMergeOne = async (userId: number, face: { itemId: number; faceIndex: number }) => {
    setMerging(true);
    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, faces: [face] })
      });
      if (!res.ok) throw new Error('Quick tag failed');
      setMessage({ type: 'success', text: 'Face identified successfully.' });
      const freshData = await fetchData();
      await maybeOfferProfilePictureFallback(userId, face.itemId, freshData.users);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setMerging(false);
    }
  };

  const handleIgnore = async () => {
    if (!selectedCluster) return;
    if (selectedFaces.length === 0) {
      setMessage({ type: 'info', text: 'Select at least one face to ignore.' });
      return;
    }
    if (!window.confirm(`Mark ${selectedFaces.length} selected face(s) as 'Not a Person'? They will be hidden from discovery.`)) return;
    
    setIgnoring(true);
    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faces: selectedFaces })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Selected faces hidden from discovery.' });
      setSelectedCluster(null);
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Ignore failed.' });
    } finally {
      setIgnoring(false);
    }
  };

  const handleResetIgnored = async () => {
    if (!window.confirm("Bring back all 'Ignored' faces to the Discovery list?")) return;
    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/reset-ignored`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: 'success', text: data.message });
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const openPreview = async (faces: { itemId: number; box?: any; url: string } | { itemId: number; box?: any; url: string }[]) => {
    const list = Array.isArray(faces) ? faces : [faces];
    if (list.length === 0) return;

    setPreviewNaturalSize(null);
    setPreview({ 
      open: true, 
      itemId: list[0].itemId, 
      item: null, 
      boxes: list.map(f => f.box).filter(b => !!b), 
      loading: true, 
      error: null 
    });

    try {
      const data = await fetchGalleryItem(list[0].itemId);
      setPreview(prev => ({ ...prev, item: data, loading: false }));
    } catch (e: any) {
      setPreview(prev => ({ ...prev, loading: false, error: 'Failed to load photo.' }));
    }
  };

  return (
    <div style={{ paddingBottom: '6rem', minHeight: '100vh' }}>
      <div style={{ marginBottom: '3rem' }}>
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-0.04em', margin: '0 0 0.5rem', color: 'var(--text-main)' }}
        >
          People Discovery
        </motion.h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0, maxWidth: '600px' }}>
              Our AI found these unknown faces. Review them to build your personal face recognition library.
            </p>
            <button 
              onClick={handleResetIgnored}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer', padding: 0, marginTop: '0.5rem', fontWeight: 700 }}
            >
              Reset Ignored Faces (Restore hidden people)
            </button>
          </div>
          <button
            onClick={() => {
              fetch(`${API_BASE}/gallery/refresh`, { method: 'POST' });
              setMessage({ type: 'info', text: 'Deep scanning gallery...' });
              setTimeout(() => fetchData(), 3000);
            }}
            className="btn btn-primary"
            style={{ borderRadius: '16px', padding: '12px 28px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 10px 25px -5px rgba(99,102,241,0.4)' }}
          >
            Run AI Sync
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
          <div className="loading-spinner" style={{ width: 60, height: 60, borderTopColor: 'var(--primary)' }}></div>
        </div>
      ) : clusters.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ background: 'white', borderRadius: '32px', padding: '80px 20px', textAlign: 'center', border: '1px dashed var(--border-color)', boxShadow: 'var(--shadow)' }}
        >
          <div style={{ background: 'rgba(99,102,241,0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <UserPlus size={40} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>All Caught Up!</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem' }}>Every face in your gallery has been identified or ignored.</p>
          <button 
            onClick={handleResetIgnored}
            className="btn btn-outline"
            style={{ borderRadius: '12px', padding: '8px 20px' }}
          >
            View Ignored Faces
          </button>
        </motion.div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2.5rem' }}>
          <AnimatePresence>
            {clusters.map((cluster, idx) => (
              <motion.div
                key={cluster.clusterId}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="discovery-card"
                style={{ 
                  cursor: 'pointer', 
                  borderRadius: '32px', 
                  background: 'white',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: 'var(--shadow)'
                }}
                whileHover={{ y: -10, background: '#ffffff', border: '1px solid #cbd5e1' }}
                onClick={() => setSelectedCluster(cluster)}
              >
                <div style={{ height: '300px', position: 'relative', background: '#000' }}>
                   <img
                      src={cluster.anchorImage}
                      alt="Unknown photo"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', background: 'rgba(99,102,241,0.95)', padding: '6px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 900, color: 'white', backdropFilter: 'blur(10px)' }}>
                      {cluster.faceCount} {cluster.faceCount === 1 ? 'Unknown Face' : 'Unknown Faces'}
                    </div>
                </div>
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Unmatched Photo</h4>
                  <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Open this photo and assign the correct user manually</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* DISCOVERY MODAL */}
      <AnimatePresence>
        {selectedCluster && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            onClick={() => setSelectedCluster(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#0b1020', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '32px', padding: '2.5rem', width: '100%', maxWidth: '750px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: 'white' }}>Review Person</h3>
                  <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.4)' }}>Choose a user to assign these {selectedFaces.length} selected photos.</p>
                </div>
                <button onClick={() => setSelectedCluster(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', cursor: 'pointer', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
              </div>

              {/* Focus Face & Actions */}
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '2.5rem' }}>
                <FaceCrop src={selectedCluster.anchorImage} box={selectedCluster.anchorBox} size={140} borderRadius={24} paddingFactor={1.3} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <AnimatePresence>
                        {selectedFaces.length > 0 && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={() => {
                              const firstSelected = selectedFaces[0];
                              // Find ALL selected faces that belong to the SAME photo as the first selected one
                              const samePhotoFaces = selectedCluster.relatedPhotos.filter(p => 
                                selectedFaces.some(sf => sf.itemId === p.itemId && sf.faceIndex === p.faceIndex) &&
                                p.itemId === firstSelected.itemId
                              );
                              if (samePhotoFaces.length > 0) openPreview(samePhotoFaces);
                            }}
                            style={{ flex: '1 1 120px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: 'var(--primary)', padding: '12px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                          >
                            <Eye size={18} /> View Selected
                          </motion.button>
                        )}
                      </AnimatePresence>

                      <button 
                        onClick={handleIgnore}
                        disabled={ignoring || merging || selectedFaces.length === 0}
                        style={{ flex: '1 1 120px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '12px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', opacity: selectedFaces.length === 0 ? 0.5 : 1 }}
                      >
                        <EyeOff size={18} /> Not a Person
                      </button>
                      
                      <button 
                        onClick={() => setShowAllFaces(!showAllFaces)}
                        style={{ flex: '1 1 120px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}
                      >
                        {showAllFaces ? <EyeOff size={18} /> : <Eye size={18} />} 
                        {showAllFaces ? 'Hide photos' : `See all ${selectedCluster.faceCount}`}
                      </button>
                   </div>
                   <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                     {selectedFaces.length > 0 ? `Click 'View Selected' to inspect the ${selectedFaces.length} marked photos.` : "Tip: Select individual photos below to tag or ignore them."}
                   </p>
                </div>
              </div>

              {/* Photo Evidence (Collapsible) */}
              <AnimatePresence>
                {showAllFaces && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', marginBottom: '2.5rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Select Photos to Tag/Ignore</div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                         <button onClick={() => setSelectedFaces(selectedCluster.relatedPhotos.map(p => ({ itemId: p.itemId, faceIndex: p.faceIndex })))} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}>Select All</button>
                         <button onClick={() => setSelectedFaces([])} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}>Clear</button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1.25rem' }}>
                      {selectedCluster.relatedPhotos.map(p => {
                        const isSelected = selectedFaces.some(f => f.itemId === p.itemId && f.faceIndex === p.faceIndex);
                        return (
                          <div 
                            key={`${p.itemId}-${p.faceIndex}`} 
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('face', JSON.stringify({ itemId: p.itemId, faceIndex: p.faceIndex }));
                              e.currentTarget.style.opacity = '0.4';
                              e.currentTarget.style.transform = 'scale(0.9)';
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.style.opacity = isSelected ? '1' : '0.4';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            style={{ position: 'relative', cursor: 'grab', transition: 'all 0.2s' }} 
                            onClick={() => toggleFace({ itemId: p.itemId, faceIndex: p.faceIndex })}
                            onDoubleClick={(e) => { e.stopPropagation(); openPreview(p); }}
                          >
                             <FaceCrop 
                               src={p.url} 
                               box={p.box} 
                               size={130} 
                               borderRadius={20} 
                               paddingFactor={1.3} 
                               style={{ border: isSelected ? '3px solid var(--primary)' : '2px solid rgba(255,255,255,0.1)', opacity: isSelected ? 1 : 0.4 }} 
                             />
                             {isSelected && (
                               <div style={{ position: 'absolute', top: -5, right: -5, background: 'var(--primary)', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '12px', border: '2px solid #0b1020' }}>
                                 ✓
                               </div>
                             )}
                             {/* QUICK ASSIGN DROPDOWN */}
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setActiveMenuFace(activeMenuFace?.itemId === p.itemId && activeMenuFace?.faceIndex === p.faceIndex ? null : { itemId: p.itemId, faceIndex: p.faceIndex });
                               }}
                               style={{ position: 'absolute', bottom: -6, left: -6, background: 'var(--primary)', border: '2px solid rgba(255,255,255,0.3)', width: 36, height: 36, borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 4px 10px rgba(99,102,241,0.4)', transition: 'all 0.2s', transform: activeMenuFace?.itemId === p.itemId && activeMenuFace?.faceIndex === p.faceIndex ? 'scale(1.1)' : 'scale(1)' }}
                             >
                               <UserPlus size={18} />
                             </button>

                             <AnimatePresence>
                               {activeMenuFace?.itemId === p.itemId && activeMenuFace?.faceIndex === p.faceIndex && (
                                 <motion.div 
                                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                   animate={{ opacity: 1, y: 0, scale: 1 }}
                                   exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                   style={{ position: 'absolute', top: '100%', left: 0, background: '#12172b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '0.6rem', zIndex: 1000, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', width: '200px', pointerEvents: 'auto' }} 
                                   onClick={e => e.stopPropagation()}
                                 >
                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', padding: '4px 10px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.05em' }}>Identify As...</div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'none' }}>
                                      {users.map(u => (
                                        <button 
                                          key={u.id}
                                          onClick={() => {
                                            handleMergeOne(u.id, p);
                                            setActiveMenuFace(null);
                                          }}
                                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', padding: '10px', textAlign: 'left', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'background 0.2s' }}
                                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                           <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.name}`} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                                           <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{u.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sticky User Selection at Bottom */}
              <div style={{ 
                position: 'sticky', 
                bottom: '-2.5rem', 
                left: '-2.5rem', 
                right: '-2.5rem', 
                background: 'rgba(11, 16, 32, 0.95)', 
                backdropFilter: 'blur(20px)',
                padding: '1.5rem 2.5rem',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                margin: '2.5rem -2.5rem -2.5rem -2.5rem',
                zIndex: 100,
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span>{selectedFaces.length > 0 ? `Assign ${selectedFaces.length} Selected` : "Drag a photo onto a user to Tag"}</span>
                   {selectedFaces.length === 0 && <span style={{ color: 'var(--primary)', textTransform: 'none', fontStyle: 'italic' }}>Tip: Drag & Drop photo here</span>}
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
                  {users.map(u => (
                    <motion.button
                      key={u.id}
                      whileHover={{ y: -5, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.background = 'rgba(99,102,241,0.3)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                        const data = e.dataTransfer.getData('face');
                        if (data) {
                          const face = JSON.parse(data);
                          // If dropping a face that is part of the selection, tag ALL selected
                          // Otherwise, just tag that one face
                          const isPartOfSelection = selectedFaces.some(f => f.itemId === face.itemId && f.faceIndex === face.faceIndex);
                          const facesToTag = isPartOfSelection ? selectedFaces : [face];
                          
                          setMerging(true);
                          try {
                            const res = await fetch(`${API_BASE}/gallery/clusters/merge`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: u.id, faces: facesToTag })
                            });
                            const result = await res.json();
                            if (!res.ok) throw new Error(result.error);
                            setMessage({ type: 'success', text: `Tagged ${facesToTag.length} photos to ${u.name}` });
                            const freshData = await fetchData();
                            await maybeOfferProfilePictureFallback(u.id, facesToTag[0].itemId, freshData.users);
                            setSelectedCluster(null);
                          } catch (err: any) {
                            setMessage({ type: 'error', text: err.message });
                          } finally {
                            setMerging(false);
                          }
                        }
                      }}
                      onClick={() => handleMerge(u.id)}
                      disabled={merging}
                      style={{ 
                        flex: '0 0 140px',
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        borderRadius: '20px', 
                        padding: '1rem', 
                        cursor: merging ? 'not-allowed' : 'pointer', 
                        color: 'white', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.name}`} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, pointerEvents: 'none' }}>{u.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL PHOTO PREVIEW (Same as Gallery) */}
      <AnimatePresence>
        {preview.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
            onClick={() => setPreview({ ...preview, open: false })}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1000px, 95vw)', maxHeight: '90vh', overflow: 'hidden', background: '#070a16', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem' }}>Evidence Review</div>
                <button onClick={() => setPreview({ ...preview, open: false })} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
              </div>

              <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
                {preview.loading ? <div className="loading-spinner"></div> : preview.item && (
                   <div style={{ position: 'relative' }}>
                      <img src={preview.item.url} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px' }} onLoad={(e) => setPreviewNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                      {previewNaturalSize && preview.boxes.map((box, i) => (
                        <div key={i} style={{
                          position: 'absolute',
                          left: `${((box.x || box._x) / previewNaturalSize.w) * 100}%`,
                          top: `${((box.y || box._y) / previewNaturalSize.h) * 100}%`,
                          width: `${((box.width || box._width) / previewNaturalSize.w) * 100}%`,
                          height: `${((box.height || box._height) / previewNaturalSize.h) * 100}%`,
                          border: '4px solid var(--primary)',
                          borderRadius: '8px',
                          boxShadow: i === 0 ? '0 0 0 9999px rgba(0,0,0,0.4)' : 'none', // Darken background only for the first box to avoid overlap mess
                          zIndex: 10
                        }} />
                      ))}
                   </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: message.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(99, 102, 241, 0.95)', backdropFilter: 'blur(10px)', padding: '1rem 2rem', borderRadius: '20px', color: 'white', fontWeight: 800, zIndex: 9999, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
        >
          {message.text}
        </motion.div>
      )}
    </div>
  );
}
