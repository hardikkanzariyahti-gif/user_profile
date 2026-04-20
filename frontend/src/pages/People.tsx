import React, { useState, useEffect } from 'react';
import { Users, AlertCircle, CheckCircle2, Combine, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { API_BASE_URL } from '../services/apiClient';

const API_BASE = `${API_BASE_URL}/api`;

interface FaceCluster {
  clusterId: string;
  faceCount: number;
  anchorImage: string;
  anchorBox: any;
  relatedPhotos: { itemId: number; faceIndex: number; url: string; }[];
}

export default function People() {
  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  const [selectedCluster, setSelectedCluster] = useState<FaceCluster | null>(null);
  const [merging, setMerging] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clustersRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/gallery/clusters`),
        fetch(`${API_BASE}/users`)
      ]);
      setClusters(await clustersRes.json());
      setUsers(await usersRes.json());
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load people data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleMerge = async (userId: number) => {
    if (!selectedCluster) return;
    setMerging(true);
    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, faces: selectedCluster.relatedPhotos })
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
            <p className="text-muted" style={{ margin: 0 }}>Review unknown faces automatically grouped by the AI and put a name to them!</p>
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
                     <img src={cluster.anchorImage} alt="Anchor Face" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
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

                  <p style={{ color: '#a5b4fc', marginBottom: '1rem' }}>This exact face was found {selectedCluster.faceCount} times. Select the user to instantly tag all their photos.</p>

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

      {message && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: message.type === 'error' ? 'var(--error)' : 'var(--success)', padding: '1rem 2rem', borderRadius: '12px', color: 'white', fontWeight: 600, zIndex: 9999 }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
