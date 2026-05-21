import React, { useEffect, useMemo, useState } from 'react';
import { Combine, X, Eye, EyeOff, UserPlus, Trash2, ShieldAlert, Search, ChevronLeft, Calendar, Image as ImageIcon, Filter, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomDropdown } from '../components/CustomDropdown';

import { API_BASE_URL } from '../services/apiClient';
import FaceCrop from '../components/FaceCrop';
import { fetchGallery, fetchGalleryItem, setProfilePictureFromGalleryItem } from '../services/galleryService';

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
  const [allGalleryItems, setAllGalleryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // 🔎 Modern Filtering & Searching
  const [searchTerm, setSearchTerm] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count'>('count');

  const sortOptions = [
    { value: 'count', label: 'Most Photos' },
    { value: 'name', label: 'Alphabetical' }
  ];

  // 🧘🏽 Logic State
  const [selectedCluster, setSelectedCluster] = useState<FaceCluster | null>(null);
  const [merging, setMerging] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState<{ itemId: number; faceIndex: number }[]>([]);
  const [photoDetailsById, setPhotoDetailsById] = useState<Record<number, any>>({});
  const [showAllFaces, setShowAllFaces] = useState(false);
  const [activeMenuFace, setActiveMenuFace] = useState<{ itemId: number; faceIndex: number } | null>(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState<number | null>(null);

  // 🕵🏾 Details Modal State
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);
  const [personPhotos, setPersonPhotos] = useState<any[]>([]);
  const [loadingPersonPhotos, setLoadingPersonPhotos] = useState(false);

  const [preview, setPreview] = useState<{
    open: boolean;
    itemId: number | null;
    boxes: any[];
    item: any | null;
    loading: boolean;
    error: string | null;
  }>({ open: false, itemId: null, boxes: [], item: null, loading: false, error: null });
  const [previewNaturalSize, setPreviewNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // ── FETCH & HYDRATE ───────────────────────────────────────────
  
  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [clustersRes, usersRes, galleryData] = await Promise.all([
        fetch(`${API_BASE}/gallery/clusters`),
        fetch(`${API_BASE}/users`),
        fetchGallery().catch(() => [])
      ]);

      const clustersJson = await clustersRes.json().catch(() => null);
      const usersJson = await usersRes.json().catch(() => null);

      const newUsers = Array.isArray(usersJson) ? usersJson : [];
      setClusters(Array.isArray(clustersJson) ? clustersJson : []);
      setUsers(newUsers);
      setAllGalleryItems(Array.isArray(galleryData) ? galleryData : []);
      
      return { 
        clusters: Array.isArray(clustersJson) ? clustersJson : [], 
        users: newUsers 
      };
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load people data.' });
      return { clusters: [], users: [] };
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Automatically attach photo count from aggregated gallery items to users
  const enrichedUsers = useMemo(() => {
    return users.map(u => {
      // Count occurrences where current user is in recognizedUserIds
      const count = allGalleryItems.filter(item => 
        (item.recognizedUserIds || []).map(Number).includes(Number(u.id))
      ).length;
      return { ...u, photoCount: count };
    });
  }, [users, allGalleryItems]);

  // Filtering/Sorting Pipeline
  const filteredAndSortedUsers = useMemo(() => {
    let list = enrichedUsers.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortBy === 'name') {
      list = list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = list.sort((a, b) => b.photoCount - a.photoCount);
    }
    
    return list;
  }, [enrichedUsers, searchTerm, sortBy]);

  // 🔎 Identity Assignment Modal Filters
  const filteredModalUsers = useMemo(() => {
    const q = modalSearchTerm.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => u.name.toLowerCase().includes(q));
  }, [users, modalSearchTerm]);

  // 📅 Chronological Grouping for selected person
  const groupedPersonPhotos = useMemo(() => {
    if (!personPhotos.length) return [];
    
    const today = new Date();
    const todayStr = today.toLocaleDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();
    
    const groups: Record<string, { title: string; time: number; items: any[] }> = {};
    
    personPhotos.forEach((img) => {
      const rawTs = img.uploadedAt || img.createdAt || img.capturedAt || null;
      
      let d: Date;
      let isUnknown = false;
      
      if (!rawTs) {
        isUnknown = true;
      } else {
        const tempDate = new Date(rawTs);
        if (isNaN(tempDate.getTime()) || tempDate.getTime() === 0) {
          isUnknown = true;
        } else {
          d = tempDate;
        }
      }
      
      if (isUnknown) {
        const key = 'unknown';
        if (!groups[key]) {
          groups[key] = { title: 'Unknown Date', time: -9999999999999, items: [] };
        }
        groups[key].items.push(img);
        return;
      }
      
      // Key format: YYYY-MM-DD
      const key = d!.toISOString().split('T')[0];
      const localStr = d!.toLocaleDateString();
      
      if (!groups[key]) {
        let title = d!.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        if (localStr === todayStr) title = 'Today';
        else if (localStr === yesterdayStr) title = 'Yesterday';
        else if (d!.getFullYear() === today.getFullYear()) {
          title = d!.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
        } else {
          title = d!.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
        groups[key] = { title, time: d!.getTime(), items: [] };
      }
      groups[key].items.push(img);
    });

    return Object.values(groups).sort((a, b) => b.time - a.time);
  }, [personPhotos]);

  // Load photos for detailed modal
  const handleOpenPersonDetail = async (user: any) => {
    setSelectedPerson(user);
    setLoadingPersonPhotos(true);
    setPersonPhotos([]); // clear previous
    try {
      const res = await fetchGallery(Number(user.id));
      setPersonPhotos(Array.isArray(res) ? res : []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load tagging data.' });
    } finally {
      setLoadingPersonPhotos(false);
    }
  };

  // ── BUSINESS LOGIC PRESERVATION ───────────────────────────────

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
      await fetchData(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to set profile picture.' });
    }
  };

  const handleMerge = async (userId: number) => {
    if (!selectedCluster) return;
    if (selectedFaces.length === 0) {
      setMessage({ type: 'info', text: 'Select at least one face to tag.' });
      return;
    }
    setMerging(true);
    const facesToTag = [...selectedFaces];
    const firstItemId = facesToTag[0].itemId;

    const currentClusterId = selectedCluster.clusterId;
    setSelectedCluster(null);
    setClusters(prev => prev.filter(c => c.clusterId !== currentClusterId));

    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, faces: facesToTag })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: `Success! Tagged ${facesToTag.length} photos. Syncing...` });
      fetch(`${API_BASE}/gallery/refresh`, { method: 'POST' });
      const freshData = await fetchData(true);
      maybeOfferProfilePictureFallback(userId, firstItemId, freshData.users);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Merge failed.' });
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
    if (!window.confirm(`Mark ${selectedFaces.length} selected face(s) as 'Not a Person'?`)) return;

    setIgnoring(true);
    const facesToIgnore = [...selectedFaces];
    const currentClusterId = selectedCluster.clusterId;
    setSelectedCluster(null);
    setClusters(prev => prev.filter(c => c.clusterId !== currentClusterId));

    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faces: facesToIgnore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Selected faces hidden.' });
      await fetchData(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Ignore failed.' });
    } finally {
      setIgnoring(false);
    }
  };

  const handleResetIgnored = async () => {
    if (!window.confirm("Restore all hidden faces?")) return;
    try {
      const res = await fetch(`${API_BASE}/gallery/clusters/reset-ignored`, { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      setMessage({ type: 'success', text: 'Discovery backlog cleared.' });
      fetchData(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const openPreview = async (item: any) => {
    setPreviewNaturalSize(null);
    setPreview({ open: true, itemId: item.id, item: null, boxes: [], loading: true, error: null });
    try {
      const data = await fetchGalleryItem(item.id);
      setPreview(prev => ({ ...prev, item: data, loading: false }));
    } catch {
      setPreview(prev => ({ ...prev, loading: false, error: 'Load failed' }));
    }
  };

  // Effect for prefetching evidence pics in selectedCluster cluster
  useEffect(() => {
    setModalSearchTerm('');
    if (!selectedCluster) { setSelectedFaces([]); setShowAllFaces(false); return; }
    setSelectedFaces([{ itemId: selectedCluster.relatedPhotos[0].itemId, faceIndex: selectedCluster.relatedPhotos[0].faceIndex }]);
  }, [selectedCluster]);

  return (
    <div style={{ paddingBottom: '6rem', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
      <style>{`
        .person-card-group:hover .hover-overlay { opacity: 1 !important; }
      `}</style>
      
      {/* 🌊 Hyper-Modern Clean Header Array */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        flexWrap: 'wrap', gap: '1.5rem', marginTop: '2.5rem', marginBottom: '3rem' 
      }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>People & Faces</h1>
          <p className="text-muted" style={{ fontSize: '0.95rem', margin: '0.3rem 0 0' }}>Manage {users.length} recognized identities and {clusters.length} pending groups.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Dynamic Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', opacity: 0.5, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search people..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                background: 'rgba(255, 255, 255, 0.85)', 
                border: '1px solid var(--border-color)', 
                height: '40px',
                padding: '0 1rem 0 2.5rem', 
                borderRadius: '10px', 
                fontSize: '0.9rem', 
                fontWeight: 600,
                width: '220px', 
                outline: 'none',
                color: 'var(--text-main)',
                transition: 'all 0.2s'
              }}
              className="people-search-input"
            />
          </div>

          {/* Shared Reusable Custom Dropdown */}
          <CustomDropdown 
            value={sortBy} 
            onChange={setSortBy} 
            options={sortOptions} 
            width="160px" 
          />

          <button 
            onClick={() => {
              fetch(`${API_BASE}/gallery/refresh`, { method: 'POST' });
              setMessage({ type: 'info', text: 'AI processing scans in background...' });
            }}
            className="btn btn-primary"
            style={{ height: '40px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem' }}
          >
            <Combine size={16} /> Scan Library
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
          gap: '2.5rem 1.5rem' 
        }}>
          {[1,2,3,4,5,6,7,8,9,10].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', opacity: 0.5 }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-card)', animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: '0.8rem', width: '60%', background: 'var(--bg-card)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* 👥 SECTION ONE: KNOWN PEOPLE */}
          <div style={{ marginBottom: '4.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Recognized Individuals <span style={{ opacity: 0.4, fontWeight: 400, fontSize: '0.9rem' }}>({filteredAndSortedUsers.length})</span>
            </h2>

            {filteredAndSortedUsers.length === 0 ? (
              <div style={{ padding: '3rem', background: '#f8fafc', borderRadius: '20px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                <p style={{ color: '#64748b', fontWeight: 500 }}>No people found matching "{searchTerm}".</p>
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                gap: '3rem 2rem' 
              }}>
                {filteredAndSortedUsers.map((user, idx) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -6 }}
                    transition={{ delay: idx * 0.02 }}
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}
                    onClick={() => handleOpenPersonDetail(user)}
                    className="person-card-group"
                  >
                    <div style={{ 
                      width: '140px', height: '140px', borderRadius: '50%', overflow: 'hidden', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', marginBottom: '16px',
                      border: '4px solid #ffffff', background: '#f1f5f9',
                      transition: 'all 0.2s ease', position: 'relative'
                    }} className="circular-face-container">
                      <img 
                        src={user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff&size=128`} 
                        alt={user.name}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Hover Overlay */}
                      <div className="hover-overlay" style={{
                        position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        opacity: 0, transition: 'opacity 0.2s ease'
                      }}>
                        <button className="btn" style={{ background: '#ffffff', color: '#0f172a', border: 'none', borderRadius: '20px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); handleOpenPersonDetail(user); }}>
                          <Eye size={14} /> View
                        </button>
                        <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '20px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); /* TODO: Edit */ }}>
                          <Combine size={14} /> Merge
                        </button>
                      </div>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', color: '#0f172a', letterSpacing: '-0.01em' }}>{user.name}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{user.photoCount} photos</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Active recently</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 🕵🏾 SECTION TWO: UNNAMED DISCOVERY CLUSTERS */}
          {clusters.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  Add Names <span style={{ opacity: 0.8, fontWeight: 600, fontSize: '0.9rem', color: '#94a3b8' }}>({clusters.length})</span>
                </h2>
                <button 
                  onClick={handleResetIgnored}
                  style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                >
                  <EyeOff size={14} /> Recover Ignored
                </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                gap: '3rem 2rem' 
              }}>
                {clusters.map((cluster, idx) => (
                  <motion.div
                    key={cluster.clusterId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -6 }}
                    transition={{ delay: idx * 0.02 }}
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}
                    onClick={() => setSelectedCluster(cluster)}
                    className="person-card-group"
                  >
                    <div style={{ 
                      width: '140px', height: '140px', borderRadius: '50%', overflow: 'hidden', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', marginBottom: '16px',
                      border: '4px dashed #cbd5e1', background: '#f8fafc',
                      position: 'relative', transition: 'all 0.2s ease'
                    }} className="circular-face-container">
                      {/* We use FaceCrop if box data is present, otherwise img fallback */}
                      {cluster.anchorBox ? (
                        <FaceCrop src={cluster.anchorImage} box={cluster.anchorBox} size={140} borderRadius={100} paddingFactor={1.2} />
                      ) : (
                        <img src={cluster.anchorImage} alt="Unmatched" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="hover-overlay" style={{
                        position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(2px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.2s ease'
                      }}>
                        <button className="btn" style={{ background: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '20px', padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 6px -1px rgba(99,102,241,0.2)' }} onClick={(e) => { e.stopPropagation(); setSelectedCluster(cluster); }}>
                          <UserPlus size={16} /> Assign
                        </button>
                      </div>

                      <div style={{ 
                        position: 'absolute', bottom: '8px', right: '8px', 
                        background: '#6366f1', borderRadius: '50%', 
                        width: '28px', height: '28px', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', color: 'white',
                        border: '3px solid #ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}>
                        <UserPlus size={14} />
                      </div>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#6366f1', letterSpacing: '-0.01em' }}>Assign Identity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{cluster.faceCount} photos</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ──────────────────────────────────────────────────────────────────
           🧑🏽‍🎤 PERSON DETAIL GLASSMORPHIC MODAL
          ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(25px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            onClick={() => setSelectedPerson(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              style={{ 
                background: '#0b0f19', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '32px', 
                width: '100%', maxWidth: '1400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 50px 100px rgba(0,0,0,0.8)'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Dynamic Header for Person */}
              <div style={{ 
                position: 'relative', padding: '2.5rem', flexShrink: 0, 
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(255,255,255,0.03) 100%)', 
                borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                  <img 
                    src={selectedPerson.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedPerson.name)}&background=6366f1&color=fff&size=256`} 
                    style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}
                  />
                  <div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>{selectedPerson.name}</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.6rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ImageIcon size={16} /> {personPhotos.length} Photos Found</span>
                      {personPhotos.length > 0 && <span>•</span>}
                      {personPhotos.length > 0 && <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.5px' }}>CONFIRMED IDENTITY</span>}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedPerson(null)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content Grid - Chronological (Full Width) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem' }} className="custom-scrollbar">
                {loadingPersonPhotos ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : groupedPersonPhotos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'rgba(255,255,255,0.4)' }}>
                    <Info size={48} style={{ marginBottom: '1.25rem', opacity: 0.6 }} />
                    <h3 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 800 }}>No tagged photos found yet.</h3>
                    <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>Run a library scan to automatically recognize this person in your uploads.</p>
                  </div>
                ) : (
                  <div className="timeline-flow">
                    {groupedPersonPhotos.map((group) => (
                      <div key={group.title} style={{ marginBottom: '3rem' }}>
                        <div style={{ 
                          position: 'sticky', top: '-2px', zIndex: 20, background: '#0b0f19', 
                          padding: '0.75rem 0', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.5px' }}>{group.title}</h4>
                        </div>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', 
                          gap: '1.25rem' 
                        }}>
                          {group.items.map((item) => (
                            <motion.div
                              key={item.id}
                              whileHover={{ scale: 1.03, y: -3 }}
                              transition={{ duration: 0.2 }}
                              style={{ 
                                aspectRatio: '1 / 1', borderRadius: '16px', overflow: 'hidden', 
                                cursor: 'pointer', position: 'relative', 
                                border: '1px solid rgba(255,255,255,0.05)',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                                background: '#1e293b'
                              }}
                              onClick={() => openPreview(item)}
                            >
                              <img 
                                src={item.thumbnailUrl || item.url} 
                                alt=""
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#0f172a' }}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  const full = (item as any).url;
                                  if (target.src !== full && full) {
                                    target.src = full;
                                  } else {
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent && !parent.querySelector('.img-placeholder')) {
                                      const ph = document.createElement('div');
                                      ph.className = 'img-placeholder';
                                      ph.style.cssText = 'width:100%;height:100%;background:#1e293b;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:1.5rem;aspect-ratio:1/1;';
                                      ph.textContent = '🖼️';
                                      parent.insertBefore(ph, target);
                                    }
                                  }
                                }}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────────────
           🔎 PREVIOUS LEGACY CLUSTER DISCOVERY MODAL (Stylized)
          ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCluster && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(8px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            onClick={() => { setSelectedCluster(null); setSelectedIdentityId(null); setModalSearchTerm(''); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }}
              onClick={e => e.stopPropagation()}
              style={{ 
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', 
                width: '100%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', 
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
              }}
            >
              {/* Header */}
              <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Assign Identity</h3>
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>Select a profile or create a new person.</p>
                </div>
                <button onClick={() => { setSelectedCluster(null); setSelectedIdentityId(null); setModalSearchTerm(''); }} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
              </div>

              {/* Scrollable Body */}
              <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                  <div style={{ position: 'relative', padding: '6px', background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', borderRadius: '50%', boxShadow: '0 10px 20px rgba(99,102,241,0.15)' }}>
                    <FaceCrop 
                      src={selectedCluster.anchorImage} 
                      box={selectedCluster.anchorBox} 
                      size={120} borderRadius={100} paddingFactor={1.3} 
                      style={{ border: '4px solid #ffffff' }}
                    />
                  </div>
                </div>
                
                {/* Search Box */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <Search size={18} style={{ position: 'absolute', left: '16px', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    placeholder="Search existing profile..." 
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    style={{ 
                      width: '100%',
                      background: '#f8fafc', 
                      border: '1px solid #e2e8f0', 
                      padding: '0.9rem 1rem 0.9rem 2.8rem', 
                      borderRadius: '16px', 
                      fontSize: '0.95rem', 
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#6366f1')}
                    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                  />
                </div>

                {modalSearchTerm.trim().length > 0 && filteredModalUsers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                    No exact matches found.
                  </div>
                )}
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  {/* Create New Person Card */}
                  {modalSearchTerm.trim().length > 0 && (
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/users`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              name: modalSearchTerm.trim(), 
                              email: `user_${Date.now()}@example.com`,
                              password: `Pass_${Date.now()}`
                            })
                          });
                          if (!res.ok) throw new Error('Failed to create person');
                          const newUser = await res.json();
                          setUsers(prev => [...prev, newUser]);
                          setSelectedIdentityId(newUser.id);
                        } catch (err: any) {
                          setMessage({ type: 'error', text: err.message });
                        }
                      }}
                      style={{ 
                        background: '#f0fdf4', borderRadius: '16px', padding: '1rem', 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', 
                        cursor: 'pointer', border: '2px dashed #86efac',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                        <UserPlus size={24} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16a34a', textAlign: 'center' }}>Create New</span>
                    </motion.div>
                  )}
                  {filteredModalUsers.map(u => (
                    <motion.div
                      key={u.id}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setSelectedIdentityId(u.id)}
                      style={{ 
                        background: selectedIdentityId === u.id ? '#eef2ff' : '#ffffff', 
                        borderRadius: '16px', padding: '1rem', 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', 
                        cursor: 'pointer', 
                        border: selectedIdentityId === u.id ? '2px solid #6366f1' : '2px solid #f1f5f9',
                        position: 'relative',
                        transition: 'all 0.2s'
                      }}
                    >
                      {selectedIdentityId === u.id && (
                        <div style={{ position: 'absolute', top: -8, right: -8, background: '#6366f1', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ffffff' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                        </div>
                      )}
                      <img 
                        src={u.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=f1f5f9&color=64748b`} 
                        style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', textAlign: 'center' }}>{u.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ borderTop: '1px solid #f1f5f9', padding: '1.5rem 2rem', display: 'flex', gap: '1rem', background: '#f8fafc', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
                 <button 
                    onClick={handleIgnore}
                    disabled={ignoring}
                    style={{ background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', padding: '0.8rem 1.2rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <EyeOff size={16} /> Not a Person
                  </button>
                  <div style={{ flex: 1 }} />
                  <button 
                    onClick={() => { setSelectedCluster(null); setSelectedIdentityId(null); setModalSearchTerm(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#64748b', padding: '0.8rem 1.2rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (!selectedIdentityId) return;
                      await handleMerge(selectedIdentityId);
                      setSelectedIdentityId(null);
                    }}
                    disabled={!selectedIdentityId || merging}
                    style={{ background: selectedIdentityId ? '#6366f1' : '#cbd5e1', border: 'none', color: 'white', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 700, cursor: selectedIdentityId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: selectedIdentityId ? '0 4px 12px rgba(99,102,241,0.3)' : 'none', transition: 'all 0.2s' }}
                  >
                    {merging ? 'Assigning...' : 'Assign Identity'}
                  </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX PREVIEW FOR SINGLE IMAGE */}
      <AnimatePresence>
        {preview.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
            onClick={() => setPreview({ ...preview, open: false })}
          >
             <button style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={36} /></button>
             {preview.loading ? <div className="loading-spinner" /> : preview.item && (
                <motion.img 
                  initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                  src={preview.item.url} 
                  style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 50px 100px rgba(0,0,0,0.6)' }} 
                />
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <motion.div
          initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
          style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: message.type === 'error' ? '#ef4444' : 'var(--primary)', backdropFilter: 'blur(10px)', padding: '1rem 2.5rem', borderRadius: '16px', color: 'white', fontWeight: 800, zIndex: 9999, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
        >
          {message.text}
        </motion.div>
      )}

      <style>{`
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 0.7; } 100% { opacity: 0.4; } }
        .circular-face-container:hover img { transform: scale(1.1); }
        .circular-face-container img { transition: transform 0.3s ease; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
