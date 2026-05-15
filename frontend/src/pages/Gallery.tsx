import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Camera, X, ChevronLeft, ChevronRight, Album as AlbumIcon, CheckSquare, Square, Share2, Hash, RefreshCw, RotateCcw, ChevronDown, Trash2, Eye, Info, MapPin, Calendar, Users, Box, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';
import SuggestionModal from '../components/SuggestionModal';
import { fetchGallery, uploadGallery, refreshGallery, getSyncStatus, openSyncEvents, setGalleryItemHashtags, deleteGalleryItem, untagFaceInPhoto, tagFaceInPhoto, getTagSuggestions, forceScanItem, updateCustomMetadata, fetchImageStatus, fetchGalleryItem, backfillMetadata, getBackfillStatus, retryMetadataExtraction } from '../services/galleryService';
import { createAlbum } from '../services/albumService';
import { request as apiRequest } from '../services/apiClient';

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
  metadata?: {
    person_count?: number;
    dominant_color?: string;
    aspect_ratio?: number;
    orientation?: string;
    [key: string]: any;
  };
  scanStatus?: string;
  metadataStatus?: string;
  uploadStatus?: string;
  thumbnailUrl?: string;
}

interface GalleryProps {
  loggedInUser: UserProfile | null;
}

const Gallery: React.FC<GalleryProps> = ({ loggedInUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [customLocationDraft, setCustomLocationDraft] = useState('');
  const [customEventDraft, setCustomEventDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [scenesDraft, setScenesDraft] = useState('');
  const [objectsDraft, setObjectsDraft] = useState('');
  const [ocrTextDraft, setOcrTextDraft] = useState('');
  const [savingCustomMetadata, setSavingCustomMetadata] = useState(false);
  const [editingCustomMetadata, setEditingCustomMetadata] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openHashtagsEditorNext, setOpenHashtagsEditorNext] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [scanningBanner, setScanningBanner] = useState<{ count: number; progress: number; done: boolean } | null>(null);
  const scanTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const syncEventsRef = React.useRef<EventSource | null>(null);
  const scanStartTimesRef = React.useRef<Record<number, number>>({});

  // --- Suggestion Modal State ---
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionData, setSuggestionData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string; profilePicture?: string }>>([]);

  // --- Album Selection State ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24); // Virtualization slice (Requirement 4)

  // --- Metadata Backfill State ---
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ total: number; processed: number; failed: number } | null>(null);
  const backfillPollRef = React.useRef<any>(null);

  const loggedInUserId = loggedInUser ? Number(loggedInUser.originalId ?? loggedInUser.id) : null;

  const getProgressFromStatus = useCallback((img: any) => {
    if (img.uploadStatus === 'uploading') return 0;
    const isScanDone = img.scanStatus === 'completed' || img.scanStatus === 'failed';
    const isMetaDone = img.metadataStatus === 'completed' || img.metadataStatus === 'failed';
    if (isScanDone && isMetaDone) return 100;

    if (img.metadataStatus === 'metadata_generation') return 80;
    if (img.metadataStatus === 'object_detection') return 60;
    if (img.scanStatus === 'face_scan') return 40;
    if (img.scanStatus === 'saved' || img.metadataStatus === 'saved') return 20;
    if (img.scanStatus === 'processing' || img.metadataStatus === 'processing') return 20;
    if (img.scanStatus === 'pending' || img.metadataStatus === 'pending') return 10;
    return 0;
  }, []);

  useEffect(() => {
    const pending = images.filter(img => {
      if (String(img.id).includes('profile-') || String(img.id).includes('opt-')) return true; // Always keep optimistic
      if (img.isProfile) return false;
      const isScanDone = img.scanStatus === 'completed' || img.scanStatus === 'failed';
      const isMetaDone = img.metadataStatus === 'completed' || img.metadataStatus === 'failed';
      return !isScanDone || !isMetaDone || img.uploadStatus === 'uploading';
    }).filter(img => !String(img.id).includes('profile-'));

    if (pending.length > 0) {
      const totalPct = pending.reduce((sum, img) => sum + getProgressFromStatus(img), 0);
      const avgPct = Math.round(totalPct / pending.length);
      
      setScanningBanner({
        count: pending.length,
        progress: Math.min(99, avgPct),
        done: false
      });
    } else {
      setScanningBanner(prev => {
        if (prev && !prev.done) {
          setTimeout(() => setScanningBanner(null), 3000);
          return { ...prev, progress: 100, done: true };
        }
        return prev;
      });
    }
  }, [images, getProgressFromStatus]);

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
    const searchParam = searchParams.get('search');
    if (searchParam !== null) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

  useEffect(() => {
    loadGallery();
  }, [loggedInUserId, viewMode, searchQuery]);

  useEffect(() => {
    // If user is not logged in, personal mode makes no sense (and leads to confusing empty-state text).
    if (!loggedInUserId && viewMode === 'personal') setViewMode('global');
  }, [loggedInUserId, viewMode]);

  // ðŸ“… [UI Redesign Step 1] - Hierarchical Chronological Grouping Logic
  const groupedImages = useMemo(() => {
    const visibleList = images.slice(0, visibleCount);

    // Get relative boundary references
    const today = new Date();
    const todayStr = today.toLocaleDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    const groups: Record<string, { title: string; time: number; items: any[] }> = {};

    visibleList.forEach((img) => {
      const ts = (img as any).uploadedAt || (img as any).createdAt || 0;
      const d = ts ? new Date(ts) : new Date();

      // Key format: YYYY-MM-DD to aggregate cleanly across time offsets
      const key = d.toISOString().split('T')[0];
      const localStr = d.toLocaleDateString();

      if (!groups[key]) {
        let title = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        if (localStr === todayStr) title = 'Today';
        else if (localStr === yesterdayStr) title = 'Yesterday';
        else if (d.getFullYear() === today.getFullYear()) {
          // Simple string if this year: e.g. "Monday, October 12"
          title = d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
        } else {
          title = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }

        groups[key] = { title, time: d.getTime(), items: [] };
      }
      groups[key].items.push(img);
    });

    // Return strictly sorted descending order array of buckets
    return Object.values(groups).sort((a, b) => b.time - a.time);
  }, [images, visibleCount]);

  // Keep a ref to images so interval can read without re-mounting
  const imagesRef = React.useRef(images);
  imagesRef.current = images;
  const selectedImageRef = React.useRef(selectedImage);
  selectedImageRef.current = selectedImage;
  const visibleCountRef = React.useRef(visibleCount);
  visibleCountRef.current = visibleCount;

  useEffect(() => {
    // Single stable interval - does NOT remount when images change.
    // imagesRef.current always reflects the latest images state.
    const attemptCounts: Record<number, number> = {};
    const lastAttemptTime: Record<number, number> = {};
    const MAX_ATTEMPTS = 40; // 40 attempts max per image

    // Exponential backoff: attempt 0â†’3s, 1â†’4s, 2â†’6s, 3â†’9s, 4â†’12s, 5+â†’15s
    const getDelayMs = (attempt: number) => Math.min(3000 * Math.pow(1.4, attempt), 15000);

    const interval = setInterval(async () => {
      // Only poll visible images to scale gracefully with 1000+ items
      const currentVisible = imagesRef.current.slice(0, visibleCountRef.current);
      const now = Date.now();

      const pendingImages = currentVisible.filter((img) => {
        if (img.isProfile) return false;
        const idStr = String(img.id);
        if (!img.id || idStr === 'undefined' || idStr === 'null' || idStr.includes('profile-') || idStr.includes('opt-')) return false;
        const needsScan = img.scanStatus !== 'completed' && img.scanStatus !== 'failed';
        const needsMeta = img.metadataStatus !== 'completed' && img.metadataStatus !== 'failed';
        return needsScan || needsMeta;
      });

      if (pendingImages.length === 0) return; // Nothing to do

      // Filter to images whose backoff delay has elapsed
      const readyImages = pendingImages.filter((img) => {
        const idNum = Number(img.id);
        const attempt = attemptCounts[idNum] || 0;
        const last = lastAttemptTime[idNum] || 0;
        return (now - last) >= getDelayMs(attempt);
      });

      if (readyImages.length === 0) return;

      console.log(`[Gallery Polling] ðŸ” Checking ${readyImages.length} pending image(s)...`);
      const activeBatch = readyImages.slice(0, 3); // max 3 per tick

      for (const p of activeBatch) {
        const idNum = Number(p.id);
        const attempt = attemptCounts[idNum] || 0;
        attemptCounts[idNum] = attempt + 1;
        lastAttemptTime[idNum] = now;

        if (attempt >= MAX_ATTEMPTS) {
          console.warn(`[Gallery Polling] â±ï¸ Max attempts reached for image ${idNum}. Marking failed.`);
          setImages(prev => prev.map(img =>
            Number(img.id) === idNum ? {
              ...img,
              scanStatus: img.scanStatus === 'completed' ? 'completed' : 'failed',
              metadataStatus: img.metadataStatus === 'completed' ? 'completed' : 'failed',
            } : img
          ));
          delete attemptCounts[idNum];
          delete lastAttemptTime[idNum];
          continue;
        }

        const freshData = await fetchImageStatus(idNum).catch(() => null);
        if (!freshData) continue;

        console.log(`[Gallery Polling] image ${idNum} (attempt ${attempt + 1}) â†’ scan:${freshData.scanStatus} meta:${freshData.metadataStatus}`);

        const isScanDone = freshData.scanStatus === 'completed' || freshData.scanStatus === 'failed';
        const isMetaDone = freshData.metadataStatus === 'completed' || freshData.metadataStatus === 'failed';

        // Stream partial updates immediately so tags appear as soon as ready
        setImages(prev => prev.map(img =>
          Number(img.id) === idNum ? { ...img, ...freshData } : img
        ));
        const sel = selectedImageRef.current;
        if (sel && Number(sel.id) === idNum) {
          setSelectedImage(prev => prev ? { ...prev, ...freshData } : prev);
        }

        if (isScanDone && isMetaDone) {
          console.log(`[Gallery Polling] âœ… Image ${idNum} done (scan=${freshData.scanStatus}, meta=${freshData.metadataStatus}). Fetching final state...`);
          delete attemptCounts[idNum];
          delete lastAttemptTime[idNum];

          try {
            const finalFullItem = await fetchGalleryItem(idNum);
            if (finalFullItem) {
              setImages(prev => prev.map(img =>
                Number(img.id) === idNum ? finalFullItem : img
              ));
              if (sel && Number(sel.id) === idNum) {
                setSelectedImage(finalFullItem);
              }
            }
          } catch (err) {
            console.error(`[Gallery Polling] Failed to fetch final state for ${idNum}:`, err);
          }
        }

      }
    }, 1000); // Check every 1s; per-image backoff controls actual request frequency

    return () => clearInterval(interval);
  }, []); // â† Empty deps: single persistent interval for the component lifetime

  // Requirement 7: Detail background hydration for modals
  useEffect(() => {
    if (!selectedImage || !selectedImage.id) return;
    const idStr = String(selectedImage.id);
    if (idStr.includes('profile-') || idStr === 'undefined') return;

    let active = true;
    const loadFullData = async () => {
      try {
        const details = await fetchGalleryItem(Number(selectedImage.id));
        if (active) {
          setSelectedImage(prev => {
            if (prev && prev.id === selectedImage.id) {
              return { ...prev, ...details };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[Hydration] Detail fetch failed:', err);
      }
    };
    loadFullData();
    return () => { active = false; };
  }, [selectedImage?.id]);

  useEffect(() => {
    if (!selectedImage || selectedImage.isProfile) return;
    const tags = Array.isArray(selectedImage.hashtags) ? selectedImage.hashtags : [];
    setHashtagsDraft(tags.map(t => `#${t}`).join(' '));
    setEditingHashtags(openHashtagsEditorNext);
    setOpenHashtagsEditorNext(false);

    const meta = (selectedImage.metadata || {}) as any;
    setCustomLocationDraft(meta.location || meta.customLocation || '');
    setCustomEventDraft(meta.eventName || meta.customEvent || '');
    setDescriptionDraft(meta.description || meta.aiSummary || '');
    setScenesDraft(meta.scene || '');
    setObjectsDraft(meta.detectedObjects || '');
    setOcrTextDraft(Array.isArray(meta.ocrText) ? meta.ocrText.join(', ') : '');
    setEditingCustomMetadata(false);
  }, [selectedImage?.id]);

  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedImage]);

  const loadGallery = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userIdToFetch = (viewMode === 'personal' && loggedInUserId) ? loggedInUserId : undefined;
      const data = await fetchGallery(userIdToFetch, searchQuery);
      setImages(data);
    } catch (err) {
      console.error(err);
      setImages([]);
      setMessage({ type: 'error', text: (err as any).message });
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await apiRequest('/api/users');
      setAllUsers(Array.isArray(users) ? users.map((u: any) => ({
        id: u.id,
        name: u.name,
        profilePicture: u.profile_picture || u.profilePicture,
      })) : []);
    } catch (err) {
      console.warn('Could not load users for suggestions:', err);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, []);

  // Backfill progress polling â€” runs only while a backfill is active
  useEffect(() => {
    if (!backfillRunning) return;
    const poll = async () => {
      try {
        const status = await getBackfillStatus();
        setBackfillProgress({ total: status.total, processed: status.processed, failed: status.failed });
        if (!status.running) {
          setBackfillRunning(false);
          console.log('[Backfill] âœ… Finished. Refreshing gallery...');
          loadGallery(true); // silent refresh
        }
      } catch (err) {
        console.warn('[Backfill] Status poll failed:', err);
      }
    };
    poll(); // immediate first check
    backfillPollRef.current = setInterval(poll, 2000);
    return () => clearInterval(backfillPollRef.current);
  }, [backfillRunning]);

  const handleBackfill = async (force = false) => {
    if (backfillRunning) return;
    try {
      const result = await backfillMetadata(force);
      if (result.running || result.total > 0) {
        setBackfillRunning(true);
        setBackfillProgress({ total: result.total, processed: 0, failed: 0 });
        console.log(`[Backfill] ðŸš€ Started â€” ${result.total} image(s) to process.`);
      } else {
        setBackfillProgress({ total: 0, processed: 0, failed: 0 });
        // All done already
        setTimeout(() => setBackfillProgress(null), 3000);
      }
    } catch (err) {
      console.error('[Backfill] Failed to start:', err);
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
    if (refreshing) {
      // Prefer SSE to avoid polling storms. Fallback to polling if SSE unavailable.
      if (syncEventsRef.current) {
        try { syncEventsRef.current.close(); } catch { }
        syncEventsRef.current = null;
      }

      let hasFinished = false;
      const es = openSyncEvents(async (status) => {
        if (status && status.isScanning) {
          setMessage({ type: 'info', text: `AI task running: ${status.current} / ${status.total}` });
        } else if (status && !status.isScanning) {
          if (hasFinished) return;
          hasFinished = true;
          setRefreshing(false);
          await loadGallery(true);
          setMessage({ type: 'success', text: 'AI sync complete. Gallery updated.' });
          setTimeout(() => setMessage(null), 5000);
        }
      }, async () => {
        // SSE failed â†’ fallback polling
        try {
          const status = await getSyncStatus();
          if (status && status.isScanning) {
            setMessage({ type: 'info', text: `AI task running: ${status.current} / ${status.total}` });
          }
        } catch { }
      });

      if (es) syncEventsRef.current = es;
      else {
        const interval = setInterval(async () => {
          try {
            const status = await getSyncStatus();
            if (status && status.isScanning) {
              setMessage({ type: 'info', text: `AI task running: ${status.current} / ${status.total}` });
            } else if (status && !status.isScanning) {
              setRefreshing(false);
              clearInterval(interval);
              await loadGallery(true);
              setMessage({ type: 'success', text: 'AI sync complete. Gallery updated.' });
              setTimeout(() => setMessage(null), 5000);
            }
          } catch { }
        }, 1500);
        return () => clearInterval(interval);
      }
    }
    return () => {
      if (syncEventsRef.current) {
        try { syncEventsRef.current.close(); } catch { }
        syncEventsRef.current = null;
      }
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
    const objectUrlsToRevoke: string[] = [];

    // 1. Instant UI Feedback: Construct Optimistic Temporary Items
    const optimisticItems = files.map((file, idx) => {
      const localUrl = URL.createObjectURL(file);
      objectUrlsToRevoke.push(localUrl);
      return {
        id: `opt-${Date.now()}-${idx}`,
        url: localUrl,
        thumbnailUrl: localUrl,
        uploadedAt: new Date().toISOString(),
        scanStatus: 'pending',
        metadataStatus: 'pending',
        uploadStatus: 'uploading',
        hashtags: [],
        people: [],
        isProfile: false,
      } as any;
    });

    // Instantly prepend to view state to provide immediate UX feedback (<15ms!)
    setImages(prev => [...optimisticItems, ...prev]);

    const formData = new FormData();
    files.forEach((file) => formData.append('gallery', file));

    try {
      // 2. Execute Actual Asset Upload in Background
      const result = await uploadGallery(formData, loggedInUserId || undefined);

      // Revoke local preview blobs now that remote urls exist to preserve RAM
      objectUrlsToRevoke.forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });

      let galleryData = result;
      let suggestions = null;

      if (result.gallery && result.suggestions) {
        galleryData = result.gallery;
        suggestions = result.suggestions;
      }

      // Hydrate real DB images (automatically replaces optimistic placeholders because they aren't in final payload)
      setImages(Array.isArray(galleryData) ? galleryData : []);
      await loadAllUsers();

      if (suggestions && suggestions.lowConfidenceCount > 0) {
        setSuggestionData(suggestions);
        setShowSuggestionModal(true);
      } else if (suggestions && suggestions.highConfidenceCount > 0) {
        setMessage({ type: 'success', text: `${suggestions.highConfidenceCount} face(s) auto-tagged!` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      // Cleanup blobs on failure as well
      objectUrlsToRevoke.forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      // Remove optimistic items if upload failed
      setImages(prev => prev.filter(img => !String(img.id).includes('opt-')));
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

  const handleConfirmTag = async (faceIndex: number, userId: number) => {
    if (!suggestionData) return;

    await tagFaceInPhoto(suggestionData.itemId, userId, faceIndex);

    setImages(prev => prev.map(img => {
      const id = typeof img.id === 'string' ? parseInt(img.id.replace('profile-', ''), 10) : img.id;
      if (id === suggestionData.itemId) {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
          return {
            ...img,
            recognizedUsers: [...(img.recognizedUsers || []), user as UserProfile],
          };
        }
      }
      return img;
    }));

    const updatedFaces = suggestionData.faces.map((f: any) =>
      f.faceIndex === faceIndex ? { ...f, isConfident: true } : f
    );
    const lowConfRemaining = updatedFaces.filter((f: any) => !f.isConfident).length;
    setSuggestionData({ ...suggestionData, faces: updatedFaces, lowConfidenceCount: lowConfRemaining });
  };

  const handleDismissSuggestion = () => {
    setShowSuggestionModal(false);
    setSuggestionData(null);
  };

  const handleSkipSuggestions = () => {
    setShowSuggestionModal(false);
    setSuggestionData(null);
    // Let SSE-driven banner continue; if SSE isn't available, fall back to a slower poll.
    if (!syncEventsRef.current) {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      setScanningBanner({ count: 1, progress: 0, done: false });
      const POLL_MS = 1500;
      scanTimerRef.current = setInterval(async () => {
        try {
          const status = await getSyncStatus();
          if (status && status.isScanning) {
            const pct = status.total > 0 ? Math.min(99, Math.round((status.current / status.total) * 100)) : 0;
            setScanningBanner(prev => prev ? { ...prev, progress: pct } : null);
          } else {
            clearInterval(scanTimerRef.current!);
            scanTimerRef.current = null;
            setScanningBanner(prev => prev ? { ...prev, progress: 100, done: true } : null);
            setTimeout(() => setScanningBanner(null), 3000);
          }
        } catch { }
      }, POLL_MS);
    }
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

  const handleStartEditingMetadata = () => {
    if (!selectedImage) return;
    const meta = (selectedImage.metadata || {}) as any;

    // 1. Standard strings
    setCustomEventDraft(meta.eventName ?? meta.customEvent ?? '');
    setCustomLocationDraft(meta.location ?? meta.customLocation ?? '');

    // 2. Normalized extraction paths matching view container
    const rawObjects = meta.objects || (selectedImage as any).objectTags || [];
    const cleanObjects = Array.from(new Set(rawObjects.map((o: any) => {
      const name = typeof o === 'string' ? o : (o.name || o.label || '');
      return name.trim().toLowerCase();
    }).filter(Boolean))) as string[];

    const rawScenes = meta.scenes || (selectedImage as any).sceneTags || [];
    const cleanScenes = Array.from(new Set(rawScenes.map((s: any) => {
      const label = typeof s === 'string' ? s : (s.label || '');
      return label.trim().toLowerCase();
    }).filter(Boolean))) as string[];

    const rawOcr = meta.ocrText || (selectedImage as any).ocrText || [];
    const cleanOcr = Array.from(new Set(rawOcr.map((t: any) => String(t || '').trim()).filter((t: any) => t.length > 1))) as string[];

    const rawTags = selectedImage.hashtags || meta.hashtags || [];
    const cleanHashtags = Array.from(new Set(rawTags.map((t: any) => String(t || '').trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean))) as string[];

    // Heuristic fallback mappings identical to viewer layout
    const isStrictAIScan = meta.strictAIActive === true || 
                           meta.metadataVersion === 'strict-v1' || 
                           (meta.rawJson && (meta.rawJson.strictAIActive === true || meta.rawJson.metadataVersion === 'strict-v1'));

    if (!isStrictAIScan) {
      if (cleanObjects.length === 0 && cleanHashtags.length > 0) {
        const tagToObjectMap: Record<string, string> = {
          laptop: "laptop", phone: "phone", screen: "screen", chair: "chair",
          couch: "couch/sofa", sofa: "couch/sofa", keyboard: "keyboard",
          mouse: "mouse", watch: "watch", backpack: "backpack", bottle: "bottle"
        };
        cleanHashtags.forEach(h => {
          const clean = h.replace(/^#/, '').toLowerCase();
          if (tagToObjectMap[clean] && !cleanObjects.includes(tagToObjectMap[clean])) {
            cleanObjects.push(tagToObjectMap[clean]);
          } else if (clean.includes('laptop') && !cleanObjects.includes('laptop')) {
            cleanObjects.push('laptop');
          } else if (clean.includes('phone') && !cleanObjects.includes('phone')) {
            cleanObjects.push('phone');
          } else if (clean.includes('screen') && !cleanObjects.includes('screen')) {
            cleanObjects.push('screen');
          }
        });
      }
      if (cleanScenes.length === 0 && cleanHashtags.length > 0) {
        const tagToSceneMap: Record<string, string> = {
          office_event: "office/workspace", office: "office/workspace",
          group_photo: "group photo", landscape: "outdoor/nature",
          indoor: "indoor", nature: "nature"
        };
        cleanHashtags.forEach(h => {
          const clean = h.replace(/^#/, '').toLowerCase();
          if (tagToSceneMap[clean] && !cleanScenes.includes(tagToSceneMap[clean])) {
            cleanScenes.push(tagToSceneMap[clean]);
          }
        });
      }
    }

    // Populate states
    setObjectsDraft(cleanObjects.join(', '));
    setScenesDraft(cleanScenes.join(', '));
    setOcrTextDraft(cleanOcr.join(', '));
    setHashtagsDraft(cleanHashtags.map(t => `#${t}`).join(' '));

    // Build display fallback for AI Summary / Description
    const personCount = meta.peopleCount ?? meta.personCount ?? selectedImage.recognizedUsers?.length ?? 0;
    const location = meta.location ?? meta.customLocation ?? '';

    let aiSummary = meta.aiSummary || meta.description || meta.caption || "";
    if (!aiSummary.trim()) {
      const segments: string[] = [];
      if (personCount > 0) {
        segments.push(personCount === 1 ? "1 person" : `${personCount} people`);
      }
      if (cleanScenes.length > 0) {
        const primaryScene = cleanScenes[0];
        segments.push(`situated in ${primaryScene}`);
      }
      if (cleanObjects.length > 0) {
        const topObj = cleanObjects.slice(0, 3).join(", ");
        segments.push(`featuring ${topObj}`);
      }
      if (location) {
        segments.push(`at ${location}`);
      }
      if (segments.length > 0) {
        aiSummary = segments.join(" ").charAt(0).toUpperCase() + segments.join(" ").slice(1) + ".";
      } else {
        aiSummary = "Image processed successfully with basic environmental elements.";
      }
    }
    setDescriptionDraft(aiSummary);

    setEditingCustomMetadata(true);
  };

  const handleSaveCustomMetadata = async () => {
    if (!selectedImage || selectedImage.isProfile) return;
    const itemId = typeof selectedImage.id === 'string'
      ? parseInt(selectedImage.id.replace('profile-', ''), 10)
      : selectedImage.id;
    if (isNaN(itemId as number)) return;

    setSavingCustomMetadata(true);
    try {
      const scenesArray = scenesDraft.split(',').map(s => s.trim()).filter(Boolean);
      const objectsArray = objectsDraft.split(',').map(o => o.trim()).filter(Boolean);
      const ocrTextArray = ocrTextDraft.split(',').map(t => t.trim()).filter(Boolean);

      // Back-compatible schema packing supporting both legacy and strict specifications!
      const updatePayload = {
        customLocation: customLocationDraft.trim(),
        customEvent: customEventDraft.trim(),
        location: customLocationDraft.trim(),
        eventName: customEventDraft.trim(),
        description: descriptionDraft.trim(),
        aiSummary: descriptionDraft.trim(),
        scenes: scenesArray,
        objects: objectsArray,
        ocrText: ocrTextArray,
      };

      // Parallelize persistence calls to ensure both custom analytics and tags update securely!
      const [metaResult, tagsResult] = await Promise.all([
        updateCustomMetadata(itemId as number, updatePayload),
        setGalleryItemHashtags(itemId as number, parsedHashtagsDraft)
      ]);

      const updatedMeta = metaResult?.metadata || {};
      const updatedHashtags = Array.isArray(tagsResult?.hashtags) ? tagsResult.hashtags : (metaResult?.hashtags || []);

      // Sync local store state
      setImages(prev => prev.map(img => {
        const id = typeof img.id === 'string' ? parseInt(img.id.replace('profile-', ''), 10) : img.id;
        return id === itemId ? { ...img, metadata: { ...img.metadata, ...updatedMeta }, hashtags: updatedHashtags } : img;
      }));
      setSelectedImage(prev => prev ? { ...prev, metadata: { ...prev.metadata, ...updatedMeta }, hashtags: updatedHashtags } : prev);
      
      setEditingCustomMetadata(false);
      setMessage({ type: 'success', text: 'Metadata overrides saved successfully.' });
      setTimeout(() => setMessage(null), 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save metadata overrides.' });
    } finally {
      setSavingCustomMetadata(false);
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

  const handleRescanItem = async (img: GalleryItem) => {
    const id = typeof img.id === 'string' ? parseInt(img.id.replace('profile-', ''), 10) : img.id;
    if (isNaN(id as number)) return;

    // Requirement 6: Conditional User Overwrite Thresholds
    const isUserEdited = Boolean(img.metadata?.metadataEditedByUser);
    let overwriteManualMetadata = false;

    if (isUserEdited) {
      const choice = window.confirm(
        "This photo contains user-edited metadata overrides.\n\n" +
        "Click OK to run a FULL RESCAN and overwrite your manual edits.\n" +
        "Click Cancel to preserve your manual edits while rescanning missing elements."
      );
      overwriteManualMetadata = choice;
    } else {
      const confirmed = window.confirm("Force an AI rescan for this photo? This re-runs face and object recognition.");
      if (!confirmed) return;
    }

    setRefreshing(true);
    try {
      await forceScanItem(id as number, overwriteManualMetadata);
      
      // Optimistically update statuses to pending to immediately show the "Scanning..." states in the UI
      setImages(prev => prev.map(i => {
        const curId = typeof i.id === 'string' ? parseInt(i.id.replace('profile-', ''), 10) : i.id;
        return curId === id ? { ...i, scanStatus: 'pending', metadataStatus: 'pending' } : i;
      }));
      if (selectedImage && Number(selectedImage.id) === id) {
        setSelectedImage(prev => prev ? { ...prev, scanStatus: 'pending', metadataStatus: 'pending' } : null);
      }

      await loadGallery(true);
      setMessage({ type: 'success', text: 'Photo rescan enqueued.' });
      setTimeout(() => setMessage(null), 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Rescan failed.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetryMetadata = async (img: GalleryItem) => {
    const id = typeof img.id === 'string' ? parseInt(img.id.replace('profile-', ''), 10) : img.id;
    if (isNaN(id as number)) return;

    setRefreshing(true);
    try {
      await retryMetadataExtraction(id as number);
      // Refresh from detail loader to hydrate latest
      const details = await fetchGalleryItem(id as number);
      setSelectedImage(prev => prev && prev.id === img.id ? { ...prev, ...details } : prev);
      setMessage({ type: 'success', text: 'Metadata analysis triggered.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Retry failed.' });
    } finally {
      setRefreshing(false);
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
    <div style={{ paddingBottom: '6rem', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>

      {/* AI SCANNING BANNER â€” real progress from server */}
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
            >âœ•</button>

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
                    ? 'âœ… Scan Complete!'
                    : `AI scanning ${scanningBanner.count} photo${scanningBanner.count > 1 ? 's' : ''}â€¦`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                  {scanningBanner.done
                    ? 'Gallery updated with face recognition tags.'
                    : 'Detecting faces in background â€” you can keep browsing.'}
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
              <span>{scanningBanner.done ? 'Done' : 'Processingâ€¦'}</span>
              <span>{scanningBanner.progress}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="gallery-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1.5rem', 
        marginTop: '2.5rem', 
        marginBottom: '3rem' 
      }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '2.25rem', marginBottom: '0.3rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {viewMode === 'personal' && loggedInUser ? 'Captured Moments' : 'Global Discovery'}
          </h2>
          <p className="text-muted" style={{ fontSize: '0.95rem', margin: 0 }}>
            {viewMode === 'personal' && loggedInUser
              ? `Smart gallery showing photos matched to ${loggedInUser.name}.`
              : 'Explore all community photos and identified profiles.'}
          </p>
        </div>

        <div className="flex items-center gap-3" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {loggedInUser && (
            <div className="toggle-group" style={{
              display: 'flex',
              background: 'rgba(15, 23, 42, 0.04)',
              padding: '4px',
              borderRadius: '12px',
            }}>
              <button
                onClick={() => setViewMode('personal')}
                style={{
                  height: '34px',
                  padding: '0 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'personal' ? 'white' : 'transparent',
                  boxShadow: viewMode === 'personal' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  color: viewMode === 'personal' ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                My Photos
              </button>
              <button
                onClick={() => setViewMode('global')}
                style={{
                  height: '34px',
                  padding: '0 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewMode === 'global' ? 'white' : 'transparent',
                  boxShadow: viewMode === 'global' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  color: viewMode === 'global' ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              >
                Global
              </button>
            </div>
          )}

          <div className="flex gap-2" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const ok = window.confirm('Force Rescan is slower and re-detects faces. Continue?');
                if (ok) handleRefreshRecognition(true);
              }}
              className="btn btn-outline"
              disabled={refreshing}
              style={{
                background: 'rgba(245,158,11,0.05)',
                color: '#b45309',
                border: '1px solid rgba(245,158,11,0.15)'
              }}
              title="Clears caches and forces re-detection on all photos"
            >
              <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Force Rescan
            </button>

            <button
              onClick={() => setShowCamera(true)}
              className="btn btn-outline"
            >
              <Camera size={16} /> Capture Photo
            </button>
            <label className="btn btn-primary" style={{ cursor: 'pointer', margin: 0 }}>
              <Plus size={16} /> Upload Files
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

      {/* â”€â”€ Backfill Progress Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence>
        {backfillRunning && backfillProgress && backfillProgress.total > 0 && (
          <motion.div
            key="backfill-progress"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              marginBottom: '1.5rem',
              padding: '1rem 1.5rem',
              borderRadius: '16px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontWeight: 700, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Hash size={14} />
                Generating metadata for old photosâ€¦
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {backfillProgress.processed} / {backfillProgress.total}
                {backfillProgress.failed > 0 && ` (${backfillProgress.failed} failed)`}
              </span>
            </div>
            <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
              <motion.div
                style={{
                  height: '100%',
                  borderRadius: '99px',
                  background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                  boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                }}
                animate={{ width: `${Math.round((backfillProgress.processed / backfillProgress.total) * 100)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </motion.div>
        )}
        {!backfillRunning && backfillProgress && backfillProgress.total === 0 && (
          <motion.div
            key="backfill-done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              marginBottom: '1.5rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: '#059669',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            âœ… All images already have metadata â€” nothing to process.
          </motion.div>
        )}
      </AnimatePresence>

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
            <h4 style={{ margin: 0, fontSize: '1.25rem' }}>Uploading...</h4>
            <p className="text-muted">Saving your photo to the gallery...</p>
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
        <div className="google-photos-stream">
          <AnimatePresence>
            {groupedImages.map((group) => (
              <div key={group.title} className="date-bucket" style={{ marginBottom: '2.5rem' }}>
                {/* 📌 Sticky Date Header */}
                <div style={{
                  position: 'sticky',
                  top: '75px',
                  background: 'rgba(248, 250, 252, 0.9)', // strictly matches bg-main
                  backdropFilter: 'blur(12px)',
                  zIndex: 40,
                  padding: '0.75rem 0',
                  marginBottom: '1rem',
                  borderBottom: '1px solid rgba(0,0,0,0.05)'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    margin: 0
                  }}>
                    {group.title}
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(15,23,42,0.05)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {group.items.length} items
                    </span>
                  </h3>
                </div>

                {/* 📌 The Core Dense Grid Layout */}
                <div className="gallery-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
                  gap: '1.25rem',
                }}>
                  {group.items.map((img) => {
                    // Calculate global index needed for the pagination/modal pointer
                    const index = images.findIndex(x => x.id === img.id);

                    return (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`gallery-card ${selectedIds.includes(Number(img.id)) ? 'selected' : ''}`}
                        onClick={() => toggleImageSelection(Number(img.id))}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          border: selectedIds.includes(Number(img.id)) ? '3px solid var(--primary)' : 'none',
                          borderRadius: '16px',
                          aspectRatio: '1 / 1', // Strict 1:1 cover squares
                          overflow: 'hidden',
                          boxShadow: '0 6px 12px rgba(0, 0, 0, 0.06)',
                          background: '#f8fafc'
                        }}
                      >
                        <img
                          src={img.thumbnailUrl || img.url}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            background: '#f1f5f9',
                            transition: 'transform 0.3s ease'
                          }}
                          loading="lazy" // Native performance boost
                          className="grid-thumb"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const full = (img as any).url;
                            if (target.src !== full && full) {
                              target.src = full;
                            } else {
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.img-placeholder')) {
                                const ph = document.createElement('div');
                                ph.className = 'img-placeholder';
                                ph.style.cssText = 'width:100%;height:100%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:1.5rem;aspect-ratio:1/1;';
                                ph.textContent = 'ðŸ–¼ï¸';
                                parent.insertBefore(ph, target);
                              }
                            }
                          }}
                        />

                        {/* Dense Badges Stream (Top Corners) */}
                        <div style={{ position: 'absolute', top: '6px', left: '6px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 20 }}>
                          {!img.isProfile && getProgressFromStatus(img) < 100 && (
                            <div style={{
                              background: 'rgba(99,102,241,0.95)',
                              backdropFilter: 'blur(8px)',
                              padding: '0.35rem 0.6rem',
                              borderRadius: '8px',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                            }}>
                              <div className="loading-spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px', borderTopColor: 'white', margin: 0 }}></div>
                              <span style={{ letterSpacing: '0.05em' }}>
                                {img.uploadStatus === 'uploading' ? 'UPLOADING' :
                                 img.metadataStatus === 'metadata_generation' ? 'METADATA' :
                                 img.metadataStatus === 'object_detection' ? 'OBJECTS' :
                                 img.scanStatus === 'face_scan' ? 'FACES' :
                                 'PROCESSING'}
                              </span>
                              <span style={{ opacity: 0.85, background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '4px', fontSize: '0.6rem' }}>
                                {getProgressFromStatus(img)}%
                              </span>
                            </div>
                          )}

                          {!img.isProfile && img.scanStatus === 'failed' && (
                            <div
                              title={String(img.lastScanError || (img.metadata as any)?.lastScanError || 'Unknown scanner fault')}
                              style={{
                                background: 'rgba(239,68,68,0.95)',
                                backdropFilter: 'blur(6px)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                cursor: 'pointer'
                              }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const idNum = Number(img.id);
                                setImages(prev => prev.map(item =>
                                  Number(item.id) === idNum ? { ...item, scanStatus: 'pending' } : item
                                ));
                                try { await forceScanItem(idNum); } catch (err) {
                                  setImages(prev => prev.map(item => Number(item.id) === idNum ? { ...item, scanStatus: 'failed' } : item));
                                }
                              }}
                            >
                              <AlertCircle size={10} />
                              <span>FAIL</span>
                            </div>
                          )}
                        </div>

                        {/* Tiny Selector Node */}
                        <div
                          onClick={(e) => { e.stopPropagation(); toggleImageSelection(Number(img.id)); }}
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            background: selectedIds.includes(Number(img.id)) ? 'var(--primary)' : 'rgba(0,0,0,0.25)',
                            backdropFilter: 'blur(4px)',
                            borderRadius: '50%',
                            width: '22px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            zIndex: 30,
                            border: '1px solid rgba(255,255,255,0.4)',
                            transition: 'transform 0.1s'
                          }}
                        >
                          <CheckCircle2 size={14} style={{ opacity: selectedIds.includes(Number(img.id)) ? 1 : 0.5 }} />
                        </div>

                        {/* ðŸ·ï¸ Compact User Tag Band (Bottom Float) */}
                        <div style={{
                          position: 'absolute',
                          bottom: '6px',
                          left: '6px',
                          right: '6px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '2px',
                          zIndex: 10
                        }}>
                          {img.recognizedUsers && img.recognizedUsers.length > 0 &&
                            img.recognizedUsers.slice(0, 2).map((user: any) => (
                              <div
                                key={user.id}
                                style={{
                                  background: 'rgba(15, 23, 42, 0.85)',
                                  backdropFilter: 'blur(4px)',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  fontSize: '0.6rem',
                                  fontWeight: 700,
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  maxWidth: '80px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden'
                                }}
                              >
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', overflow: 'hidden' }}>
                                  <img src={user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {user.name.split(' ')[0]}
                                </span>
                              </div>
                            ))
                          }
                          {img.recognizedUsers && img.recognizedUsers.length > 2 && (
                            <div style={{
                              background: 'rgba(15, 23, 42, 0.85)',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              color: 'white'
                            }}>
                              +{img.recognizedUsers.length - 2}
                            </div>
                          )}
                        </div>

                        {/* Hover Interaction Mask */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            zIndex: 50
                          }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenPreview(img, index); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '16px',
                              background: 'white',
                              color: 'black',
                              border: 'none',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                            }}
                          >
                            <Eye size={12} /> View
                          </button>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            {!img.isProfile && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteImage(img); }}
                                style={{
                                  width: '26px', height: '26px',
                                  borderRadius: '50%',
                                  background: 'rgba(239,68,68,0.9)',
                                  color: 'white',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            {loggedInUser && !img.isProfile && (
                              <button
                                onClick={(e) => handleOpenHashtags(img, index, e)}
                                style={{
                                  width: '26px', height: '26px',
                                  borderRadius: '50%',
                                  background: 'rgba(99,102,241,0.9)',
                                  color: 'white',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <Hash size={12} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Incremental Pagination Button (Requirement 4) */}
      {!loading && images.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setVisibleCount(prev => prev + 24)}
            style={{
              padding: '12px 36px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            className="load-more-btn"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <ChevronDown size={18} />
            Load More Memories
          </button>
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
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
              padding: '6rem 2rem 4rem', overflowY: 'auto', zIndex: 2000,
            }}
            onClick={handleClosePreview}
          >
            <div style={{ position: 'fixed', top: '2rem', right: '3.5rem', zIndex: 2005, display: 'flex', gap: '0.75rem' }}>
              {selectedImage && !selectedImage.isProfile && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleRescanItem(selectedImage)}
                    disabled={refreshing}
                    title="Rescan this photo (AI Re-detection)"
                    style={{
                      padding: '12px', borderRadius: '50%',
                      background: refreshing ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.85)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white', cursor: refreshing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <RefreshCw size={22} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
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
                    }}
                  >
                    {deleting ? <div className="loading-spinner" style={{ width: 22, height: 22, borderWidth: 2 }} /> : <Trash2 size={22} />}
                  </button>
                </div>
              )}
              <button onClick={handleClosePreview} className="btn btn-danger" style={{ padding: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white' }}>
                <X size={32} />
              </button>
            </div>

            {/* Navigation Arrows */}
            <div style={{ position: 'fixed', left: '3.5rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2005 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                className="btn"
                disabled={currentIndex === 0}
                style={{ padding: '15px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', opacity: currentIndex === 0 ? 0.2 : 1 }}
              >
                <ChevronLeft size={40} />
              </button>
            </div>

            <div style={{ position: 'fixed', right: '3.5rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2005 }}>
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
                width: 'min(1250px, 95vw)',
                height: 'auto',
                maxHeight: '90vh',
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: window.innerWidth > 992 ? '1.1fr 0.9fr' : '1fr',
                alignItems: 'center',
                gap: '2.5rem',
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(20px)',
                padding: '2.5rem',
                borderRadius: '32px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflowY: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                <img
                  src={selectedImage.url}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: window.innerWidth > 992 ? '75vh' : '50vh',
                    borderRadius: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    objectFit: 'contain',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
              </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', height: 'auto' }}>
                {(() => {
                  const meta = (selectedImage.metadata || {}) as any;
                  
                  // Unified scalar extracts supporting relational schemas
                  const rawObjects = meta.objects || (selectedImage as any).objectTags || [];
                  const rawScenes = meta.scenes || (selectedImage as any).sceneTags || [];
                  const rawOcr = meta.ocrText || (selectedImage as any).ocrText || [];
                  const rawTags = selectedImage.hashtags || meta.hashtags || [];

                  const personCount = meta.peopleCount ?? meta.personCount ?? selectedImage.recognizedUsers?.length ?? 0;
                  const dominantColor = meta.dominantColor ?? meta.dominant_color ?? null;
                  const aspectRatio = meta.aspectRatio ?? meta.aspect_ratio ?? null;
                  const orientation = meta.orientation ?? meta.customDetails?.orientation ?? null;
                  
                  const eventName = meta.eventName ?? meta.customEvent ?? '';
                  const location = meta.location ?? meta.customLocation ?? '';

                  // Deep normalization logic (Requirement 6)
                  const cleanObjects = Array.from(new Set(rawObjects.map((o: any) => {
                    const name = typeof o === 'string' ? o : (o.name || '');
                    return name.trim().toLowerCase();
                  }).filter(Boolean))) as string[];
                  
                  const cleanScenes = Array.from(new Set(rawScenes.map((s: any) => {
                    const label = typeof s === 'string' ? s : (s.label || '');
                    return label.trim().toLowerCase();
                  }).filter(Boolean))) as string[];

                  const cleanOcr = Array.from(new Set(rawOcr.map((t: any) => String(t || '').trim()).filter((t: any) => t.length > 1))) as string[];
                  const cleanHashtags = Array.from(new Set(rawTags.map((t: any) => String(t || '').trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean))) as string[];

                   // ── Client-Side Folksomonic Fallback (Requirement 4 & 7) ──────────────
                   const isStrictAIScan = meta.strictAIActive === true || 
                                          meta.metadataVersion === 'strict-v1' || 
                                          (meta.rawJson && (meta.rawJson.strictAIActive === true || meta.rawJson.metadataVersion === 'strict-v1'));
 
                   // Only engage client-side heuristics if the DB record hasn't been stamped by our high-accuracy strict AI scanner!
                   if (!isStrictAIScan) {
                     if (cleanObjects.length === 0 && cleanHashtags.length > 0) {
                       const tagToObjectMap: Record<string, string> = {
                         laptop: "laptop", phone: "phone", screen: "screen", chair: "chair",
                         couch: "couch/sofa", sofa: "couch/sofa", keyboard: "keyboard",
                         mouse: "mouse", watch: "watch", backpack: "backpack", bottle: "bottle"
                       };
                       cleanHashtags.forEach(h => {
                         const clean = h.replace(/^#/, '').toLowerCase();
                         if (tagToObjectMap[clean] && !cleanObjects.includes(tagToObjectMap[clean])) {
                           cleanObjects.push(tagToObjectMap[clean]);
                         } else if (clean.includes('laptop') && !cleanObjects.includes('laptop')) {
                           cleanObjects.push('laptop');
                         } else if (clean.includes('phone') && !cleanObjects.includes('phone')) {
                           cleanObjects.push('phone');
                         } else if (clean.includes('screen') && !cleanObjects.includes('screen')) {
                           cleanObjects.push('screen');
                         }
                       });
                     }
                     if (cleanScenes.length === 0 && cleanHashtags.length > 0) {
                       const tagToSceneMap: Record<string, string> = {
                         office_event: "office/workspace", office: "office/workspace",
                         group_photo: "group photo", landscape: "outdoor/nature",
                         indoor: "indoor", nature: "nature"
                       };
                       cleanHashtags.forEach(h => {
                         const clean = h.replace(/^#/, '').toLowerCase();
                         if (tagToSceneMap[clean] && !cleanScenes.includes(tagToSceneMap[clean])) {
                           cleanScenes.push(tagToSceneMap[clean]);
                         }
                       });
                     }
                   }

                  // ─── AI Summary Dynamic Fallback Constructor (Requirement 6) ───
                  let aiSummary = meta.aiSummary || meta.description || meta.caption || "";
                  if (!aiSummary.trim()) {
                    const segments: string[] = [];
                    if (personCount > 0) {
                      segments.push(personCount === 1 ? "1 person" : `${personCount} people`);
                    }
                    if (cleanScenes.length > 0) {
                      const primaryScene = cleanScenes[0];
                      segments.push(`situated in ${primaryScene}`);
                    }
                    if (cleanObjects.length > 0) {
                      const topObj = cleanObjects.slice(0, 3).join(", ");
                      segments.push(`featuring ${topObj}`);
                    }
                    if (location) {
                      segments.push(`at ${location}`);
                    }
                    if (segments.length > 0) {
                      aiSummary = segments.join(" ").charAt(0).toUpperCase() + segments.join(" ").slice(1) + ".";
                    } else {
                      aiSummary = "Image processed successfully with basic environmental elements.";
                    }
                  }

                  const isEdited = Boolean(meta.metadataEditedByUser);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                      
                      {/* Header Row with Provenance Badges & Edit Action */}
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
                          <button onClick={handleStartEditingMetadata} className="btn" style={{
                            padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                            color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                          }}>
                            <Info size={14} /> Edit
                          </button>
                        )}
                      </div>

                      {!editingCustomMetadata ? (
                        <>
                          {/* 1. People Found (Unified Section) */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '16px',
                            padding: '1.25rem'
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
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    padding: '4px 10px 4px 4px',
                                    borderRadius: '99px',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                  }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(255, 255, 255, 0.2)' }}>
                                      <img src={u.profilePicture} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    {u.name}
                                    {!selectedImage.isProfile && (
                                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remove ${u.name} from photo?`)) untagFaceInPhoto(Number(selectedImage.id), u.id); }}
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

                          {/* 2. Details Quick Metrics Block */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            padding: '1rem 1.25rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '1rem',
                            alignItems: 'center'
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

                          {/* 3. Context: Event & Location */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem'
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '1rem' }}>
                              <MapPin size={18} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                              <div>
                                <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
                                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem' }}>
                                  {location || <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic', fontWeight: 400 }}>Unspecified</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 4. Detailed Visual Chips Layout */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                          }}>
                            {/* Scenes Row */}
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

                            {/* Objects Row */}
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

                            {/* OCR Text Row */}
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

                            {/* Hashtags Row */}
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
                                    <button key={i} onClick={() => navigate(`/tags/${encodeURIComponent(t)}`)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}>#{t}</button>
                                  )) : <span style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontSize: '0.8rem' }}>No active tags attached.</span>}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <input value={hashtagsDraft} onChange={(e) => setHashtagsDraft(e.target.value)} placeholder="#nature #group"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: '0.85rem' }} />
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button onClick={() => { setEditingHashtags(false); setHashtagsDraft((selectedImage.hashtags || []).map((t: any) => `#${t}`).join(' ')); }}
                                      style={{ padding: '4px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={handleSaveHashtags} disabled={savingHashtags}
                                      style={{ padding: '4px 14px', borderRadius: 6, background: '#6366f1', border: 'none', color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Edit Mode: Unified Rich Form Container */
                        <div style={{ 
                          display: 'flex', flexDirection: 'column', gap: '1.25rem',
                          background: 'rgba(255, 255, 255, 0.04)', backdropFilter: 'blur(30px)',
                          padding: '1.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          {/* AI Summary / Description */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description / Manual Caption</label>
                            <textarea 
                              value={descriptionDraft} 
                              onChange={(e) => setDescriptionDraft(e.target.value)} 
                              placeholder="Compose a textual narrative describing the image context..."
                              rows={3}
                              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem', resize: 'none', lineHeight: '1.5' }}
                            />
                          </div>
                          
                          {/* Event & Location Pair Layout */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
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

                          {/* Scenes Array Text Entry */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scenes Detected (comma-separated)</label>
                            <input 
                              value={scenesDraft} 
                              onChange={(e) => setScenesDraft(e.target.value)} 
                              placeholder="indoor, corporate, meeting"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Objects Array Text Entry */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Objects Matrix (comma-separated)</label>
                            <input 
                              value={objectsDraft} 
                              onChange={(e) => setObjectsDraft(e.target.value)} 
                              placeholder="laptop, chair, desk, glasses"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* OCR Text Tokens Entry */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Text Mappings / OCR (comma-separated)</label>
                            <input 
                              value={ocrTextDraft} 
                              onChange={(e) => setOcrTextDraft(e.target.value)} 
                              placeholder="Project Vision, Roadmap, Q3 Goal"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Unified Hashtags Editor (Requirement Addendum) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hashtags Context (comma or space separated)</label>
                            <input 
                              value={hashtagsDraft} 
                              onChange={(e) => setHashtagsDraft(e.target.value)} 
                              placeholder="#meeting, corporate, photography"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Operational Trigger Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                            <button 
                              onClick={() => setEditingCustomMetadata(false)}
                              className="btn" 
                              style={{ padding: '10px 20px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Discard Changes
                            </button>
                            <button 
                              onClick={handleSaveCustomMetadata} 
                              className="btn" 
                              disabled={savingCustomMetadata} 
                              style={{ padding: '10px 24px', borderRadius: 12, background: 'rgba(99,102,241,0.9)', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              {savingCustomMetadata ? <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : 'Save Overrides'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
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

      {/* Face Tag Suggestion Modal */}
      <AnimatePresence>
        {showSuggestionModal && suggestionData && (
          <SuggestionModal
            suggestion={suggestionData}
            allUsers={allUsers}
            onConfirmTag={handleConfirmTag}
            onDismiss={handleDismissSuggestion}
            onSkip={handleSkipSuggestions}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;

