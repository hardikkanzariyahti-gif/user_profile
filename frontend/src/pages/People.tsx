import React, { useEffect, useMemo, useState } from 'react';
import { Combine, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { API_BASE_URL } from '../services/apiClient';
import FaceCrop from '../components/FaceCrop';
import { fetchGalleryItem } from '../services/galleryService';

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
  const [selectedFaces, setSelectedFaces] = useState<{ itemId: number; faceIndex: number }[]>([]);
  const [photoDetailsById, setPhotoDetailsById] = useState<Record<number, any>>({});
  const [photoDetailsLoading, setPhotoDetailsLoading] = useState<Record<number, boolean>>({});
  const [preview, setPreview] = useState<{
    open: boolean;
    itemId: number | null;
    faceIndex: number | null;
    box: any | null;
    item: any | null;
    loading: boolean;
    error: string | null;
  }>({ open: false, itemId: null, faceIndex: null, box: null, item: null, loading: false, error: null });
  const [previewNaturalSize, setPreviewNaturalSize] = useState<{ w: number; h: number } | null>(null);

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
      setClusters(Array.isArray(clustersJson) ? clustersJson : []);
      setUsers(Array.isArray(usersJson) ? usersJson : []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load people data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!selectedCluster) {
      setSelectedFaces([]);
      return;
    }
    setSelectedFaces(selectedCluster.relatedPhotos.map(p => ({ itemId: p.itemId, faceIndex: p.faceIndex })));
  }, [selectedCluster]);

  useEffect(() => {
    if (!selectedCluster) return;

    const uniqueItemIds = Array.from(new Set(selectedCluster.relatedPhotos.map(p => p.itemId)));
    const itemIdsToFetch = uniqueItemIds
      .slice(0, 24)
      .filter((id) => !photoDetailsById[id] && !photoDetailsLoading[id]);

    if (itemIdsToFetch.length === 0) return;

    itemIdsToFetch.forEach(async (id) => {
      setPhotoDetailsLoading(prev => ({ ...prev, [id]: true }));
      try {
        const data = await fetchGalleryItem(id);
        setPhotoDetailsById(prev => ({ ...prev, [id]: data }));
      } catch {
        // optional: badges just won't render for this item
      } finally {
        setPhotoDetailsLoading(prev => ({ ...prev, [id]: false }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCluster]);

  const selectedCountText = useMemo(() => {
    if (!selectedCluster) return '';
    const total = selectedCluster.relatedPhotos.length;
    const selected = selectedFaces.length;
    if (selected === total) return `Tag all ${total} photo(s)`;
    return `Tag ${selected} of ${total} photo(s)`;
  }, [selectedCluster, selectedFaces.length]);

  const toggleFace = (face: { itemId: number; faceIndex: number }) => {
    setSelectedFaces(prev => {
      const exists = prev.some(f => f.itemId === face.itemId && f.faceIndex === face.faceIndex);
      if (exists) return prev.filter(f => !(f.itemId === face.itemId && f.faceIndex === face.faceIndex));
      return [...prev, face];
    });
  };

  const openPreview = async (p: { itemId: number; faceIndex: number; box?: any; url: string }) => {
    setPreviewNaturalSize(null);
    setPreview({
      open: true,
      itemId: p.itemId,
      faceIndex: p.faceIndex,
      box: p.box ?? null,
      item: null,
      loading: true,
      error: null,
    });
    try {
      const data = await fetchGalleryItem(p.itemId);
      setPreview(prev => ({
        ...prev,
        item: data,
        loading: false,
      }));
    } catch (e: any) {
      setPreview(prev => ({
        ...prev,
        loading: false,
        error: e?.message || 'Failed to load photo details.',
      }));
    }
  };

  const closePreview = () => {
    setPreviewNaturalSize(null);
    setPreview({ open: false, itemId: null, faceIndex: null, box: null, item: null, loading: false, error: null });
  };

  const handleMerge = async (userId: number) => {
    if (!selectedCluster) return;
    if (selectedFaces.length === 0) {
      setMessage({ type: 'info', text: 'Select at least one face occurrence to tag.' });
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
      
      setMessage({ type: 'success', text: data.message });
      setSelectedCluster(null);
      await fetchData(); // reload
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Merge failed.' });
    } finally {
      setMerging(false);
    }
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
       <div className="mb-8">
          <h2 className="card-title" style={{ fontSize: '2.5rem', fontWeight: 800 }}>People Discovery</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p className="text-muted" style={{ margin: 0 }}>Review unknown faces grouped by AI and assign them to a user.</p>
            <button 
              onClick={() => {
                fetch(`${API_BASE}/gallery/refresh`, { method: 'POST' });
                setMessage({ type: 'info', text: 'AI Sync started in background...' });
                setTimeout(() => fetchData(), 2500);
              }}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '10px 20px' }}
            >
              AI Sync
            </button>
          </div>
       </div>

      {loading ? (
         <div className="text-center p-20"><div className="loading-spinner" style={{ margin: '0 auto', borderTopColor: 'var(--primary)' }}></div></div>
      ) : clusters.length === 0 ? (
         <div className="card text-center p-10"><p className="text-muted">No unknown people found! Everyone is perfectly tagged.</p></div>
      ) : (
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
            <AnimatePresence>
              {clusters.map((cluster) => (
                 <motion.div
                   key={cluster.clusterId}
                   initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                   className="card"
                   style={{ cursor: 'pointer', overflow: 'hidden', padding: 0 }}
                   onClick={() => setSelectedCluster(cluster)}
                 >
                   <div style={{ position: 'relative', height: '250px', background: '#000' }}>
                     <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <FaceCrop
                         src={cluster.anchorImage}
                         box={cluster.anchorBox}
                         size={250}
                         borderRadius={0}
                         paddingFactor={1.4}
                         style={{ border: 'none', background: 'transparent' }}
                         alt="Unknown face"
                       />
                     </div>
                     <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(99,102,241,0.9)', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.8rem' }}>
                        {cluster.faceCount} {cluster.faceCount === 1 ? 'Photo' : 'Photos'}
                     </div>
                   </div>
                   <div style={{ padding: '1rem', textAlign: 'center' }}>
                     <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Unknown Person</h3>
                     <p className="text-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Click to assign a name</p>
                   </div>
                 </motion.div>
              ))}
            </AnimatePresence>
         </div>
      )}

      {/* MERGE MODAL */}
      <AnimatePresence>
         {selectedCluster && (
            <motion.div
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               onClick={() => setSelectedCluster(null)}
            >
               <motion.div
                  initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  style={{ background: '#1e1b4b', borderRadius: '24px', padding: '2rem', width: '90%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}
               >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                     <h3 style={{ margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Combine size={24} /> Who is this?</h3>
                     <button onClick={() => setSelectedCluster(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24}/></button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <FaceCrop src={selectedCluster.anchorImage} box={selectedCluster.anchorBox} size={92} borderRadius={18} paddingFactor={1.35} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#a5b4fc', margin: 0 }}>This face was found {selectedCluster.faceCount} time(s). Choose which photos to tag, then select the user.</p>
                      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                        <button
                          className="btn"
                          onClick={() => setSelectedFaces(selectedCluster.relatedPhotos.map(p => ({ itemId: p.itemId, faceIndex: p.faceIndex })))}
                          disabled={merging}
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.85rem',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            color: 'white',
                            borderRadius: '12px',
                          }}
                        >
                          Select all
                        </button>
                        <button
                          className="btn"
                          onClick={() => setSelectedFaces([])}
                          disabled={merging}
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.85rem',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            color: 'white',
                            borderRadius: '12px',
                          }}
                        >
                          Clear
                        </button>
                        <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.85rem' }}>
                          {selectedCountText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {selectedCluster.relatedPhotos.slice(0, 24).map((p) => {
                      const isSelected = selectedFaces.some(f => f.itemId === p.itemId && f.faceIndex === p.faceIndex);
                      const details = photoDetailsById[p.itemId];
                      const recognizedUsers = Array.isArray(details?.recognizedUsers) ? details.recognizedUsers : [];
                      return (
                        <button
                          key={`${p.itemId}-${p.faceIndex}`}
                          onClick={() => toggleFace({ itemId: p.itemId, faceIndex: p.faceIndex })}
                          disabled={merging}
                          title={`Photo ${p.itemId} • Face ${p.faceIndex}`}
                          style={{
                            padding: 0,
                            background: 'transparent',
                            border: isSelected ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.12)',
                            borderRadius: '16px',
                            cursor: merging ? 'not-allowed' : 'pointer',
                            opacity: isSelected ? 1 : 0.85,
                          }}
                        >
                          <div style={{ position: 'relative' }}>
                            <FaceCrop src={p.url} box={p.box} size={80} borderRadius={14} paddingFactor={1.35} style={{ border: 'none' }} />

                            {/* Show already-recognized people (same as Gallery) */}
                            <div style={{ position: 'absolute', left: 6, top: 6, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 68, pointerEvents: 'none' }}>
                              {recognizedUsers.length > 0 ? (
                                <>
                                  {recognizedUsers.slice(0, 2).map((u: any) => (
                                    <div
                                      key={u.id}
                                      title={u.name}
                                      style={{
                                        background: 'rgba(0,0,0,0.72)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        borderRadius: 999,
                                        padding: '2px 6px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {String(u.name || '').split(' ')[0] || 'User'}
                                    </div>
                                  ))}
                                  {recognizedUsers.length > 2 && (
                                    <div
                                      title={recognizedUsers.map((u: any) => u.name).join(', ')}
                                      style={{
                                        background: 'rgba(0,0,0,0.72)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        borderRadius: 999,
                                        padding: '2px 6px',
                                        fontSize: '0.65rem',
                                        fontWeight: 900,
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      +{recognizedUsers.length - 2}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div
                                  title="No recognized users in this photo yet"
                                  style={{
                                    background: 'rgba(0,0,0,0.6)',
                                    color: 'rgba(255,255,255,0.9)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    borderRadius: 999,
                                    padding: '2px 6px',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  No names
                                </div>
                              )}
                            </div>

                            {/* This face is the unknown person we're tagging */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 6,
                                bottom: 6,
                                background: 'rgba(245,158,11,0.9)',
                                color: '#0b1020',
                                borderRadius: 999,
                                padding: '2px 6px',
                                fontSize: '0.65rem',
                                fontWeight: 950,
                                pointerEvents: 'none',
                              }}
                            >
                              Who?
                            </div>
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(p); }}
                              disabled={merging}
                              title="Preview full photo"
                              style={{
                                position: 'absolute',
                                right: 6,
                                bottom: 6,
                                background: 'rgba(0,0,0,0.65)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 10,
                                padding: '3px 7px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: merging ? 'not-allowed' : 'pointer',
                              }}
                            >
                              View
                            </button>
                          </div>
                        </button>
                      );
                    })}
                    {selectedCluster.relatedPhotos.length > 24 && (
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '16px', height: '80px' }}>
                        +{selectedCluster.relatedPhotos.length - 24} more
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                     {users.map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleMerge(u.id)}
                          disabled={merging}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem 0.5rem', cursor: merging ? 'not-allowed' : 'pointer', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.name}`} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{u.name.split(' ')[0]}</span>
                        </button>
                     ))}
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* FULL PHOTO PREVIEW */}
      <AnimatePresence>
        {preview.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.88)',
              backdropFilter: 'blur(10px)',
              zIndex: 3500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
            }}
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.97, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(980px, 96vw)',
                maxHeight: '90vh',
                overflow: 'hidden',
                background: '#0b1020',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px',
                boxShadow: '0 30px 80px rgba(0,0,0,0.65)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: 'white', fontWeight: 900 }}>Photo Preview</div>
                <button onClick={closePreview} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={22} /></button>
              </div>

              <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', overflowY: 'auto' }}>
                {preview.loading && (
                  <div style={{ color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="loading-spinner" style={{ width: 18, height: 18, borderTopColor: 'var(--primary)' }} />
                    Loading photo details...
                  </div>
                )}
                {preview.error && (
                  <div style={{ color: 'rgba(255,255,255,0.75)' }}>{preview.error}</div>
                )}

                {preview.item && (
                  <>
                    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
                      <img
                        src={preview.item.url}
                        alt="Preview"
                        onLoad={(e) => setPreviewNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                        style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', display: 'block', background: 'black' }}
                      />

                      {/* Selected face bounding box */}
                      {previewNaturalSize && preview.box && (
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                          {(() => {
                            const x = (preview.box as any)._x ?? (preview.box as any).x;
                            const y = (preview.box as any)._y ?? (preview.box as any).y;
                            const w = (preview.box as any)._width ?? (preview.box as any).width;
                            const h = (preview.box as any)._height ?? (preview.box as any).height;
                            const left = (Number(x) / previewNaturalSize.w) * 100;
                            const top = (Number(y) / previewNaturalSize.h) * 100;
                            const width = (Number(w) / previewNaturalSize.w) * 100;
                            const height = (Number(h) / previewNaturalSize.h) * 100;
                            return (
                              <>
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                    border: '3px solid rgba(99,102,241,0.95)',
                                    background: 'rgba(99,102,241,0.15)',
                                    borderRadius: 6,
                                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                                  }}
                                />
                                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(99,102,241,0.85)', color: 'white', padding: '6px 10px', borderRadius: 999, fontWeight: 900, fontSize: '0.8rem' }}>
                                  Face #{preview.faceIndex}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Already recognized in this photo
                      </div>
                      {Array.isArray(preview.item.recognizedUsers) && preview.item.recognizedUsers.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {preview.item.recognizedUsers.map((u: any) => (
                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '0.35rem 0.6rem', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>
                              <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.name}`} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                              <span>{u.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'rgba(255,255,255,0.75)' }}>No recognized users yet.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: message.type === 'error' ? 'var(--error)' : message.type === 'info' ? 'var(--primary)' : 'var(--success)', padding: '1rem 2rem', borderRadius: '12px', color: 'white', fontWeight: 600, zIndex: 9999 }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
