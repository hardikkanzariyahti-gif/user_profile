import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Camera, X, ChevronLeft, ChevronRight, Album as AlbumIcon, CheckSquare, Square, Share2, Hash, RefreshCw, RotateCcw, ChevronDown, Trash2, Eye, Info, MapPin, Calendar, Users, Box, FileText, UserPlus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CameraCapture from '../components/CameraCapture';
import SuggestionModal from '../components/SuggestionModal';
import { fetchGallery, uploadGallery, refreshGallery, getSyncStatus, openSyncEvents, setGalleryItemHashtags, deleteGalleryItem, untagFaceInPhoto, tagFaceInPhoto, getTagSuggestions, forceScanItem, updateCustomMetadata, fetchImageStatus, fetchGalleryItem, backfillMetadata, getBackfillStatus, retryMetadataExtraction, bulkTagAndAlbum, getProcessingStatus, cancelProcessing } from '../services/galleryService';
import { createAlbum, fetchAlbums, editAlbum } from '../services/albumService';
import { CreateEventModal } from '../components/CreateEventModal';
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
  startBackgroundUpload?: (
    files: File[],
    eventConfig?: { name?: string; location?: string; date?: string; desc?: string; eventId?: number; tags?: string[] }
  ) => Promise<any>;
}

const Gallery: React.FC<GalleryProps> = ({ loggedInUser, startBackgroundUpload }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [viewMode, setViewMode] = useState<'personal' | 'global'>('global');
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
  const [processingStatus, setProcessingStatus] = useState<{
    isProcessing: boolean;
    total: number;
    completed: number;
    stage: 'Upload' | 'Face' | 'Metadata' | 'Complete';
  } | null>(null);
  const [pollTrigger, setPollTrigger] = useState(0);
  const syncEventsRef = React.useRef<EventSource | null>(null);

  // --- Suggestion Modal State ---
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionData, setSuggestionData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<Array<{ id: number; name: string; profilePicture?: string }>>([]);

  // --- Album Selection State ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');

  // --- Bulk Selection Tagging State ---
  const [showTagModal, setShowTagModal] = useState(false);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [selectedUserFromSuggestions, setSelectedUserFromSuggestions] = useState<any | null>(null);
  const [taggingLoading, setTaggingLoading] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24); // Virtualization slice (Requirement 4)

  // --- Event Upload Suggestion State ---
  const [showEventSuggestionModal, setShowEventSuggestionModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [detectedUploadContext, setDetectedUploadContext] = useState<{
    dateStr: string;
    people: string[];
    uploadedImageIds: number[];
  } | null>(null);
  const [userAlbums, setUserAlbums] = useState<any[]>([]);



  // --- Step-based Event Upload Modal State ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState<'type' | 'eventInfo' | 'select' | 'progress' | 'complete'>('type');
  const [uploadType, setUploadType] = useState<'normal' | 'event'>('normal');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  // Event textual input states
  const [eventUploadName, setEventUploadName] = useState('');
  const [eventUploadLocation, setEventUploadLocation] = useState('');
  const [eventUploadDate, setEventUploadDate] = useState('');
  const [eventUploadDescription, setEventUploadDescription] = useState('');
  const [eventUploadTags, setEventUploadTags] = useState('');

  // Smart event-name suggestion state (Media Ingest Hub)
  const [eventUploadSelectedId, setEventUploadSelectedId] = useState<number | null>(null);
  const [showEventNameSuggestions, setShowEventNameSuggestions] = useState(false);
  const [eventSuggestActiveIdx, setEventSuggestActiveIdx] = useState(0);
  const [ingestAlbums, setIngestAlbums] = useState<any[]>([]);

  // Live bulk pipeline states
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{
    phase: 'uploading' | 'scanning' | 'metadata' | 'complete';
    count: number;
    total: number;
    percent: number;
  }>({
    phase: 'uploading',
    count: 0,
    total: 0,
    percent: 0
  });

  const [bulkUploadSummary, setBulkUploadSummary] = useState<{
    albumId: number | null;
    uploadedCount: number;
    facesCount: number;
    metaCount: number;
    eventName: string;
  } | null>(null);

  const loggedInUserId = loggedInUser ? Number(loggedInUser.originalId ?? loggedInUser.id) : null;

  const triggerEventSuggestionPrompt = async (uploadedItems: any[]) => {
    if (!uploadedItems || uploadedItems.length === 0 || !loggedInUserId) return;
    
    const uploadedIds = uploadedItems.map(i => i.id).filter(Boolean);
    if (uploadedIds.length === 0) return;

    const firstTs = uploadedItems[0]?.uploadedAt || uploadedItems[0]?.createdAt;
    const dateObj = firstTs ? new Date(firstTs) : new Date();
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const peopleSet = new Set<string>();
    uploadedItems.forEach(item => {
      if (item.recognizedUsers && Array.isArray(item.recognizedUsers)) {
        item.recognizedUsers.forEach((u: any) => u.name && peopleSet.add(u.name.split(' ')[0]));
      }
      if (item.people && Array.isArray(item.people)) {
        item.people.forEach((p: any) => p.name && peopleSet.add(p.name.split(' ')[0]));
      }
    });
    const people = Array.from(peopleSet);

    try {
      const albumsData = await fetchAlbums(loggedInUserId);
      setUserAlbums(albumsData);
      setDetectedUploadContext({
        dateStr,
        people,
        uploadedImageIds: uploadedIds
      });
      setShowEventSuggestionModal(true);
    } catch (err) {
      console.error('Failed to load user albums for suggestion:', err);
    }
  };

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
    let active = true;
    let timer: any = null;

    const pollStatus = async () => {
      try {
        const data = await getProcessingStatus();
        if (!active) return;
        setProcessingStatus(data);
        
        // Silent refresh of gallery if processing has just finished to display the new tags
        if (data && !data.isProcessing && data.stage === 'Complete') {
          loadGallery(true);
          // Stop polling since no active jobs exist (Requirement 8)
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
      } catch (err) {
        console.error('[Poll Status] Failed:', err);
      }
    };

    pollStatus();
    timer = setInterval(pollStatus, 2500);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollTrigger]);

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

    const action = searchParams.get('action');
    if (action === 'upload') {
      setShowUploadModal(true);
      setUploadStep('select');
      setUploadFiles([]);
      setEventUploadName('');
      setEventUploadLocation('');
      setEventUploadDate('');
      setEventUploadDescription('');
      setEventUploadTags('');
      setEventUploadSelectedId(null);
      setShowEventNameSuggestions(false);
      // Pre-load existing albums for smart suggestions
      fetchAlbums(loggedInUserId || 0).then(data => setIngestAlbums(Array.isArray(data) ? data : [])).catch(() => {});
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams);
    } else if (action === 'camera') {
      setShowCamera(true);
      
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

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
      const d = ts ? new Date(ts) : new Date(0);

      if (d.getTime() === 0) {
        if (!groups['unknown']) {
          groups['unknown'] = { title: 'Unknown Date', time: 0, items: [] };
        }
        groups['unknown'].items.push(img);
        return;
      }

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

  // Watch for global elevated background upload completions to silently update active stream views
  useEffect(() => {
    const onBgDone = () => {
      console.log('[Gallery UI] Background Ingest resolved. Executing fresh state sync.');
      loadGallery(true);
    };
    window.addEventListener('bg-upload-complete', onBgDone);
    return () => window.removeEventListener('bg-upload-complete', onBgDone);
  }, []);

  const handleBackfill = async (force = false) => {
    try {
      await backfillMetadata(force);
      setPollTrigger(prev => prev + 1);
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
      setPollTrigger(prev => prev + 1);
    } catch (err) {
      setMessage({ type: 'error', text: 'Sync failed to start. Please try again later.' });
      setRefreshing(false);
    }
  };

  const handleCancelProcessing = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to stop/cancel all active AI background scans?\n\n" +
      "This will immediately terminate all active queues and mark any missing local-file photos as skipped."
    );
    if (!confirmed) return;

    try {
      setRefreshing(true);
      const res = await cancelProcessing();
      
      // Update local state and trigger polling refresh
      setProcessingStatus({
        isProcessing: false,
        total: 0,
        completed: 0,
        stage: 'Complete'
      });
      setPollTrigger(prev => prev + 1);

      // Reload gallery immediately
      await loadGallery(true);

      setMessage({ 
        type: 'success', 
        text: res.message || 'Background AI processing cancelled successfully.' 
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to cancel background processing.' });
    } finally {
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
        try { URL.revokeObjectURL(url); } catch { }
      });

      let galleryData = result;
      let suggestions = null;

      if (result.gallery) {
        galleryData = result.gallery;
      }
      if (result.suggestions) {
        suggestions = result.suggestions;
      }

      // Hydrate real DB images (automatically replaces optimistic placeholders because they aren't in final payload)
      setImages(Array.isArray(galleryData) ? galleryData : []);
      setPollTrigger(prev => prev + 1);
      await loadAllUsers();

      if (result && result.uploadedItemIds && uploadType !== 'event') {
        const newlyUploadedItems = (Array.isArray(galleryData) ? galleryData : []).filter(img => result.uploadedItemIds?.includes(Number(img.id)));
        if (newlyUploadedItems.length > 0) {
          triggerEventSuggestionPrompt(newlyUploadedItems);
        }
      }

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
        try { URL.revokeObjectURL(url); } catch { }
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

  const executeBulkUpload = async () => {
    if (uploadFiles.length === 0) return;

    const filesToUpload = [...uploadFiles];
    const targetEventName = eventUploadName;
    const targetEventTags = eventUploadTags;

    // 1. Immediate local optimistic display for fluid UX
    const objectUrlsToRevoke: string[] = [];
    const optimisticItems = filesToUpload.map((file, idx) => {
      const localUrl = URL.createObjectURL(file);
      objectUrlsToRevoke.push(localUrl);
      return {
        id: `opt-bulk-${Date.now()}-${idx}`,
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

    setImages(prev => [...optimisticItems, ...prev]);

    // 2. Close setup overlays immediately to prevent UI blocking
    setShowUploadModal(false);

    try {
      let result: any;

      const tagsArray = targetEventTags
        ? targetEventTags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
        : undefined;

      const capturedEventId = eventUploadSelectedId;
      const eventConfig = (targetEventName.trim() || (tagsArray && tagsArray.length > 0)) ? {
        name: targetEventName.trim() || undefined,
        location: eventUploadLocation || undefined,
        date: eventUploadDate || undefined,
        desc: eventUploadDescription || undefined,
        eventId: capturedEventId || undefined,
        tags: tagsArray
      } : undefined;

      if (capturedEventId) {
        console.log(`[EVENT_SELECT] eventId: ${capturedEventId}`);
      }

      // Delegate network handling to persistent background thread in App.tsx layout
      if (startBackgroundUpload) {
        result = await startBackgroundUpload(filesToUpload, eventConfig);
      } else {
        const formData = new FormData();
        filesToUpload.forEach(f => formData.append('gallery', f));
        if (eventConfig) {
          formData.append('isEventUpload', 'true');
          if (eventConfig.name) formData.append('eventName', eventConfig.name);
          if (eventConfig.location) formData.append('eventLocation', eventConfig.location);
          if (eventConfig.date) formData.append('eventDate', eventConfig.date);
          if (eventConfig.desc) formData.append('eventDescription', eventConfig.desc);
          if (eventConfig.eventId) formData.append('eventId', String(eventConfig.eventId));
          if (eventConfig.tags) formData.append('tags', eventConfig.tags.join(','));
        }
        result = await uploadGallery(formData, loggedInUserId || undefined);
      }

      // Revoke local previews to release RAM
      objectUrlsToRevoke.forEach(u => { try { URL.revokeObjectURL(u); } catch { } });

      let galleryData = result;
      let albumId = null;

      if (result && result.gallery) {
        galleryData = result.gallery;
        albumId = result.albumId;
      }

      setImages(Array.isArray(galleryData) ? galleryData : (Array.isArray(result) ? result : []));

      if (result && result.uploadedItemIds && !albumId) {
        const newlyUploadedItems = (Array.isArray(galleryData) ? galleryData : (Array.isArray(result) ? result : [])).filter(img => result.uploadedItemIds?.includes(Number(img.id)));
        if (newlyUploadedItems.length > 0) {
          triggerEventSuggestionPrompt(newlyUploadedItems);
        }
      }

      // 3. Real-time Redirect: Shift visual anchor directly to the event collection
      if (albumId) {
        navigate(`/albums/${albumId}`);
      }

    } catch (err: any) {
      console.error('[Ingest Router] Background execution failure:', err);
      objectUrlsToRevoke.forEach(u => { try { URL.revokeObjectURL(u); } catch { } });
      setImages(prev => prev.filter(img => !String(img.id).includes('opt-bulk-')));
      setMessage({ type: 'error', text: err.message || 'Pipeline delivery failed.' });
    }
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
      setPollTrigger(prev => prev + 1);
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

  const handleOpenTagModal = async () => {
    setShowTagModal(true);
    setTaggingLoading(true);
    setTagSearchTerm('');
    setSelectedUserFromSuggestions(null);
    try {
      const res = await apiRequest('users');
      setSystemUsers(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed loading users for tag modal:', err);
    } finally {
      setTaggingLoading(false);
    }
  };

  const handleBulkTag = async (targetUserId: number | null, targetTagName?: string | null) => {
    if (selectedIds.length === 0) return;
    
    // Support non-logged in or guest user contexts seamlessly (Requirement 6)
    const activeUserId = loggedInUserId || (systemUsers.length > 0 ? Number(systemUsers[0].id) : 1);
    
    setTaggingLoading(true);
    try {
      const result = await bulkTagAndAlbum(selectedIds, targetUserId, activeUserId, targetTagName);
      setMessage({ type: 'success', text: result.message || 'Photos successfully tagged!' });

      // Flush and cleanup modal/selection context
      setIsSelectionMode(false);
      setSelectedIds([]);
      setShowTagModal(false);
      setTagSearchTerm('');
      setSelectedUserFromSuggestions(null);

      // Fetch latest images to render new recognition user badges optimistically!
      await loadGallery(true);
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error('[BulkTag] Network or API Error:', err);
      setMessage({ type: 'error', text: err.message || 'Bulk tagging failed.' });
      // Keep modal open on API failure (Requirement 7)
    } finally {
      setTaggingLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '6rem', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>

      {/* COMPACT AI PIPELINE PROGRESS BANNER */}
      <AnimatePresence>
        {processingStatus && processingStatus.isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            style={{
              position: 'fixed', bottom: '2rem', right: '2rem',
              background: 'rgba(23, 23, 37, 0.9)',
              backdropFilter: 'blur(16px)',
              color: 'white', borderRadius: '16px', padding: '1rem 1.25rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              zIndex: 9999,
              minWidth: '280px', maxWidth: '320px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: '#818cf8',
                boxShadow: '0 0 0 4px rgba(129, 140, 248, 0.25)',
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.2 }}>
                  {processingStatus.total === 1 
                    ? 'Processing 1 photo…' 
                    : `AI scanning photos… ${processingStatus.completed}/${processingStatus.total}`}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {`Stage: ${processingStatus.stage}`}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${processingStatus.total > 0 ? Math.round((processingStatus.completed / processingStatus.total) * 100) : 0}%` }}
                transition={{ duration: 0.4 }}
                style={{
                  height: '100%', borderRadius: 99,
                  background: 'linear-gradient(90deg, #818cf8, #c084fc)'
                }}
              />
            </div>

            {/* Cancel Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button
                onClick={handleCancelProcessing}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
              >
                <X size={12} /> Cancel All Processing
              </button>
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
                height: '42px',
                borderRadius: '99px',
                padding: '0 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: 'rgba(245,158,11,0.05)',
                color: '#b45309',
                border: '1px solid rgba(245,158,11,0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              title="Clears caches and forces re-detection on all photos"
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Force Rescan
            </button>
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
              background: 'rgba(241, 245, 249, 0.95)', backdropFilter: 'blur(12px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
              padding: '4rem 2rem', overflowY: 'auto', zIndex: 2000,
            }}
            onClick={handleClosePreview}
          >
            <div style={{ position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 2005, display: 'flex', gap: '0.75rem' }}>
              {selectedImage && !selectedImage.isProfile && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleRescanItem(selectedImage)}
                    disabled={refreshing}
                    title="Rescan this photo (AI Re-detection)"
                    style={{
                      padding: '10px', borderRadius: '50%',
                      background: refreshing ? '#e0e7ff' : '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: '#6366f1', cursor: refreshing ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <RefreshCw size={20} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                  <button
                    onClick={() => handleDeleteImage(selectedImage)}
                    disabled={deleting}
                    title="Delete this photo"
                    style={{
                      padding: '10px', borderRadius: '50%',
                      background: deleting ? '#fee2e2' : '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: '#ef4444', cursor: deleting ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    {deleting ? <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : <Trash2 size={20} />}
                  </button>
                </div>
              )}
              <button onClick={handleClosePreview} className="btn" style={{ padding: '10px', borderRadius: '50%', background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Navigation Arrows */}
            <div style={{ position: 'fixed', left: '2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2005 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                className="btn"
                disabled={currentIndex === 0}
                style={{ padding: '12px', borderRadius: '50%', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', opacity: currentIndex === 0 ? 0.3 : 1, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={32} />
              </button>
            </div>

            <div style={{ position: 'fixed', right: '2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2005 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                className="btn"
                disabled={currentIndex === images.length - 1}
                style={{ padding: '12px', borderRadius: '50%', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', opacity: currentIndex === images.length - 1 ? 0.3 : 1, cursor: currentIndex === images.length - 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={32} />
              </button>
            </div>

            <motion.div
              key={selectedImage.url}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              style={{
                width: 'min(1400px, 92vw)',
                height: 'auto',
                minHeight: '75vh',
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: window.innerWidth > 992 ? '1.2fr 0.8fr' : '1fr',
                alignItems: 'stretch',
                gap: '0',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left Side: Image Preview */}
              <div style={{ 
                background: '#f8fafc', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                padding: '2rem', position: 'relative', borderRight: window.innerWidth > 992 ? '1px solid #e2e8f0' : 'none',
                borderBottom: window.innerWidth <= 992 ? '1px solid #e2e8f0' : 'none'
              }}>
                <img
                  src={selectedImage.url}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: window.innerWidth > 992 ? '80vh' : '50vh',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    objectFit: 'contain',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff'
                  }}
                />
              </div>

              {/* Right Side: Metadata Panel */}
              <div className="custom-scrollbar" style={{ 
                padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', 
                maxHeight: window.innerWidth > 992 ? '85vh' : 'auto', overflowY: 'auto', background: '#ffffff' 
              }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                            Image Intelligence
                          </div>
                          {isEdited && (
                            <span style={{ background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe', padding: '3px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                              Edited
                            </span>
                          )}
                        </div>
                        {loggedInUser && !selectedImage.isProfile && !editingCustomMetadata && (
                          <button onClick={handleStartEditingMetadata} className="btn" style={{
                            padding: '6px 14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0',
                            color: '#475569', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}>
                            <Info size={14} /> Edit
                          </button>
                        )}
                      </div>

                      {!editingCustomMetadata ? (
                        <>
                          {/* 1. People Found (Unified Section) */}
                          <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '1.25rem'
                          }}>
                            <div style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Users size={16} style={{ color: '#6366f1' }} /> People Detected
                            </div>

                            {(selectedImage.scanStatus !== 'completed' && selectedImage.scanStatus !== 'failed') ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem' }}>
                                <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '1.5px', borderTopColor: '#6366f1' }}></div>
                                <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.85rem' }}>Running face detection...</span>
                              </div>
                            ) : selectedImage.recognizedUsers && selectedImage.recognizedUsers.length > 0 ? (
                              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                {selectedImage.recognizedUsers.map((u: any) => (
                                  <div key={u.id} style={{
                                    background: '#ffffff',
                                    padding: '4px 10px 4px 4px',
                                    borderRadius: '99px',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                  }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid #f1f5f9' }}>
                                      <img src={u.profilePicture} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    {u.name}
                                    {!selectedImage.isProfile && (
                                      <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remove ${u.name} from photo?`)) untagFaceInPhoto(Number(selectedImage.id), u.id); }}
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>No recognized individuals found.</span>
                            )}
                          </div>

                          {/* 2. Details Quick Metrics Block */}
                          <div style={{
                            background: '#f8fafc',
                            padding: '1rem 1.25rem',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '1rem',
                            alignItems: 'center'
                          }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Count</div>
                              <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem' }}>
                                {personCount} {personCount === 1 ? 'Person' : 'People'}
                              </div>
                            </div>

                            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Ratio</div>
                              <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem' }}>
                                {aspectRatio ? `${Number(aspectRatio).toFixed(2)}:1` : 'N/A'}
                              </div>
                            </div>

                            <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                              <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Tone</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                {dominantColor ? (
                                  <>
                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: dominantColor, border: '1px solid #cbd5e1' }} />
                                    <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>{dominantColor}</span>
                                  </>
                                ) : (
                                  <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.9rem' }}>N/A</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 3. Context: Event & Location */}
                          <div style={{
                            background: '#f8fafc',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Calendar size={18} style={{ color: '#94a3b8' }} />
                              <div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Event</div>
                                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                                  {eventName || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Unspecified</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                              <MapPin size={18} style={{ color: '#94a3b8' }} />
                              <div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Location</div>
                                <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                                  {location || <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Unspecified</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 4. Detailed Visual Chips Layout */}
                          <div style={{
                            background: '#f8fafc',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                          }}>
                            {/* Scenes Row */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Eye size={15} style={{ color: '#10b981' }} /> Scenes Detected
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {cleanScenes.length > 0 ? cleanScenes.map((s, i) => (
                                  <span key={i} style={{ background: '#dcfce7', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#166534', textTransform: 'capitalize' }}>{s}</span>
                                )) : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>No environment profiles found.</span>}
                              </div>
                            </div>

                            {/* Objects Row */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                              <div style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Box size={15} style={{ color: '#8b5cf6' }} /> Objects Matrix
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {cleanObjects.length > 0 ? cleanObjects.map((o, i) => (
                                  <span key={i} style={{ background: '#ede9fe', border: '1px solid #ddd6fe', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#5b21b6', textTransform: 'capitalize' }}>{o}</span>
                                )) : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>No visual objects identified.</span>}
                              </div>
                            </div>

                            {/* OCR Text Row */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                              <div style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={15} style={{ color: '#f59e0b' }} /> Text Recognized (OCR)
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {cleanOcr.length > 0 ? cleanOcr.map((t, i) => (
                                  <span key={i} style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e' }}>"{t}"</span>
                                )) : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>No textual data extracted.</span>}
                              </div>
                            </div>

                            {/* Hashtags Row */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Hash size={15} style={{ color: '#94a3b8' }} /> Hashtag Keywords
                                </div>
                                {loggedInUser && !selectedImage.isProfile && !editingHashtags && (
                                  <button onClick={() => setEditingHashtags(true)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                                )}
                              </div>

                              {!editingHashtags ? (
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {cleanHashtags.length > 0 ? cleanHashtags.map((t, i) => (
                                    <button key={i} onClick={() => navigate(`/tags/${encodeURIComponent(t)}`)} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: '999px', fontSize: '0.8rem', color: '#0f172a', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>#{t}</button>
                                  )) : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>No active tags attached.</span>}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <input value={hashtagsDraft} onChange={(e) => setHashtagsDraft(e.target.value)} placeholder="#nature #group"
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#ffffff', color: '#0f172a', fontSize: '0.85rem' }} />
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button onClick={() => { setEditingHashtags(false); setHashtagsDraft((selectedImage.hashtags || []).map((t: any) => `#${t}`).join(' ')); }}
                                      style={{ padding: '4px 12px', borderRadius: 6, background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
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
                          background: '#ffffff',
                          padding: '1.5rem', borderRadius: '24px', border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
                        }}>
                          {/* AI Summary / Description */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description / Manual Caption</label>
                            <textarea
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                              placeholder="Compose a textual narrative describing the image context..."
                              rows={3}
                              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem', resize: 'none', lineHeight: '1.5' }}
                            />
                          </div>

                          {/* Event & Location Pair Layout */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Name</label>
                              <input
                                value={customEventDraft}
                                onChange={(e) => setCustomEventDraft(e.target.value)}
                                placeholder="e.g. Office Summit"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</label>
                              <input
                                value={customLocationDraft}
                                onChange={(e) => setCustomLocationDraft(e.target.value)}
                                placeholder="e.g. Executive Center"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>

                          {/* Scenes Array Text Entry */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                            <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scenes Detected (comma-separated)</label>
                            <input
                              value={scenesDraft}
                              onChange={(e) => setScenesDraft(e.target.value)}
                              placeholder="indoor, corporate, meeting"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Objects Array Text Entry */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Objects Matrix (comma-separated)</label>
                            <input
                              value={objectsDraft}
                              onChange={(e) => setObjectsDraft(e.target.value)}
                              placeholder="laptop, chair, desk, glasses"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* OCR Text Tokens Entry */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Text Mappings / OCR (comma-separated)</label>
                            <input
                              value={ocrTextDraft}
                              onChange={(e) => setOcrTextDraft(e.target.value)}
                              placeholder="Project Vision, Roadmap, Q3 Goal"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Unified Hashtags Editor (Requirement Addendum) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hashtags Context (comma or space separated)</label>
                            <input
                              value={hashtagsDraft}
                              onChange={(e) => setHashtagsDraft(e.target.value)}
                              placeholder="#meeting, corporate, photography"
                              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '0.85rem' }}
                            />
                          </div>

                          {/* Operational Trigger Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                            <button
                              onClick={() => setEditingCustomMetadata(false)}
                              className="btn"
                              style={{ padding: '10px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                            >
                              Discard Changes
                            </button>
                            <button
                              onClick={handleSaveCustomMetadata}
                              className="btn"
                              disabled={savingCustomMetadata}
                              style={{ padding: '10px 24px', borderRadius: 12, background: '#6366f1', border: 'none', color: 'white', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(99,102,241,0.2)' }}
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
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowAlbumModal(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <AlbumIcon size={18} /> Create Album
              </button>
              <button
                onClick={handleOpenTagModal}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(16, 185, 129, 0.95)',
                  border: 'none'
                }}
              >
                <UserPlus size={18} /> Tag Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Tag User Selection Modal */}
      <AnimatePresence>
        {showTagModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
            }}
            onClick={() => setShowTagModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              style={{
                background: 'rgba(30, 41, 59, 0.98)', padding: '2rem', borderRadius: '24px',
                width: '90%', maxWidth: '440px', border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', gap: '1.25rem'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ color: 'white', margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <UserPlus size={20} style={{ color: '#10b981' }} /> Tag Photos
                </h2>
                <button 
                  onClick={() => setShowTagModal(false)} 
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Selected Count & Preview Thumbnails */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 600 }}>
                    SELECTED PHOTOS ({selectedIds.length})
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '6px', 
                  scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent'
                }}>
                  {images
                    .filter(img => selectedIds.includes(Number(img.id)))
                    .slice(0, 10)
                    .map(img => (
                      <div key={img.id} style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img 
                          src={img.url} 
                          alt="" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.src.startsWith('http')) {
                              target.src = `http://localhost:4001${img.url}`;
                            }
                          }}
                        />
                      </div>
                    ))}
                  {selectedIds.length > 10 && (
                    <div style={{ 
                      width: '52px', height: '52px', borderRadius: '8px', flexShrink: 0,
                      background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 700
                    }}>
                      +{selectedIds.length - 10}
                    </div>
                  )}
                </div>
              </div>

              {/* Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 600 }}>
                  PROFILE OR CUSTOM TAG NAME
                </label>
                <input
                  type="text"
                  placeholder="Type to search or create new..."
                  value={tagSearchTerm}
                  onChange={e => {
                    setTagSearchTerm(e.target.value);
                    setSelectedUserFromSuggestions(null); // Clear selected suggestion on type
                  }}
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 16px', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px',
                    color: 'white', fontSize: '0.95rem', outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
              </div>

              {/* Suggestions / Results / Helper Area */}
              <div style={{
                maxHeight: '180px', overflowY: 'auto', paddingRight: '4px',
                display: 'flex', flexDirection: 'column', gap: '0.5rem'
              }}>
                {(() => {
                  const term = tagSearchTerm.trim();
                  
                  // 1. Loading state
                  if (taggingLoading && systemUsers.length === 0) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                        <div className="loading-spinner" style={{ width: 24, height: 24 }} />
                      </div>
                    );
                  }

                  // 2. Empty input state: Show all/recent suggestions to pick from
                  if (term.length === 0) {
                    const recentSuggestions = systemUsers.slice(0, 5);
                    if (recentSuggestions.length > 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700 }}>
                            SUGGESTED PROFILES
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {recentSuggestions.map((u: any) => {
                              const isSelected = selectedUserFromSuggestions?.id === u.id;
                              return (
                                <button
                                  key={u.id}
                                  onClick={() => {
                                    setSelectedUserFromSuggestions(u);
                                    setTagSearchTerm(u.name);
                                  }}
                                  disabled={taggingLoading}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '10px 12px', borderRadius: '12px',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)',
                                    color: 'white', textAlign: 'left', cursor: 'pointer', width: '100%',
                                    transition: 'all 0.2s', border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.03)'
                                  }}
                                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                >
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                    <img
                                      src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=10b981&color=fff`}
                                      alt=""
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{u.name}</span>
                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{u.email || 'Registered User'}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                        Type a name above to search or create a custom tag.
                      </div>
                    );
                  }

                  // 3. Filtering state
                  const filtered = systemUsers.filter((u: any) => 
                    u.name.toLowerCase().includes(term.toLowerCase())
                  );

                  if (filtered.length > 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700 }}>
                          MATCHING PROFILES
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {filtered.map((u: any) => {
                            const isSelected = selectedUserFromSuggestions?.id === u.id;
                            return (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setSelectedUserFromSuggestions(u);
                                  setTagSearchTerm(u.name);
                                }}
                                disabled={taggingLoading}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                                  padding: '10px 12px', borderRadius: '12px',
                                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)',
                                  color: 'white', textAlign: 'left', cursor: 'pointer', width: '100%',
                                  transition: 'all 0.2s', border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.03)'
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                              >
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                  <img
                                    src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=10b981&color=fff`}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{u.name}</span>
                                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{u.email || 'Registered User'}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    // No suggestions: Show custom helper text (Requirement 3)
                    return (
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        color: '#34d399',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '0.25rem'
                      }}>
                        <Plus size={14} />
                        <span>New tag & album will be created: <strong>"{term}"</strong></span>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Action Buttons: Confirm & Cancel */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowTagModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                    color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Cancel
                </button>
                <button
                  disabled={!tagSearchTerm.trim() || taggingLoading}
                  onClick={() => {
                    const term = tagSearchTerm.trim();
                    if (!term) return;

                    const match = selectedUserFromSuggestions || systemUsers.find((u: any) => u.name.toLowerCase() === term.toLowerCase());
                    if (match) {
                      handleBulkTag(match.id, null);
                    } else {
                      handleBulkTag(null, term);
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                    background: 'var(--primary)', color: 'white', fontWeight: 700,
                    cursor: tagSearchTerm.trim() ? 'pointer' : 'not-allowed',
                    opacity: tagSearchTerm.trim() ? 1 : 0.5, transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { if (tagSearchTerm.trim()) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { if (tagSearchTerm.trim()) e.currentTarget.style.opacity = '1'; }}
                >
                  {taggingLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Suggestion Prompt Modal (Step 3) */}
      <AnimatePresence>
        {showEventSuggestionModal && detectedUploadContext && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem', zIndex: 6000
          }} onClick={() => setShowEventSuggestionModal(false)}>
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              style={{
                width: '100%', maxWidth: '540px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: '28px',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                color: 'white'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(99,102,241,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#818cf8', marginBottom: '0.5rem' }}>
                  <Sparkles size={22} />
                  <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Smart Event Detection</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Organize Your Uploaded Photos</h3>
                <p style={{ margin: '0.5rem 0 0', color: '#cbd5e1', fontSize: '0.95rem' }}>We detected relevant details from your {detectedUploadContext.uploadedImageIds.length} newly uploaded photos.</p>
              </div>

              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '16px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: '#e2e8f0' }}>
                    <Calendar size={18} style={{ color: '#818cf8' }} />
                    <span style={{ fontWeight: 700, color: 'white' }}>Date:</span> {detectedUploadContext.dateStr}
                  </div>
                  {detectedUploadContext.people.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: '#e2e8f0', flexWrap: 'wrap' }}>
                      <Users size={18} style={{ color: '#818cf8' }} />
                      <span style={{ fontWeight: 700, color: 'white' }}>People:</span> {detectedUploadContext.people.join(', ')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94a3b8' }}>Suggested Actions</h4>
                  
                  {userAlbums.slice(0, 3).map(album => (
                    <button
                      key={album.id}
                      onClick={async () => {
                        try {
                          const currentItemIds = album.items ? album.items.map((i: any) => i.id) : [];
                          const updatedIds = Array.from(new Set([...currentItemIds, ...detectedUploadContext.uploadedImageIds]));
                          await editAlbum(album.id, loggedInUserId || 0, { itemIds: updatedIds });
                          setMessage({ type: 'success', text: `Added ${detectedUploadContext.uploadedImageIds.length} photos to "${album.title}"` });
                          setShowEventSuggestionModal(false);
                        } catch (err: any) {
                          setMessage({ type: 'error', text: err.message || 'Failed to add photos to event' });
                        }
                      }}
                      style={{
                        padding: '1rem 1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: 'pointer', color: 'white', transition: 'all 0.2s', textAlign: 'left'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                          <AlbumIcon size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem' }}>Add to: {album.title}</div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2 }}>{album.eventType || 'Event'} • {album.items ? album.items.length : 0} photos</div>
                        </div>
                      </div>
                      <CheckCircle2 size={20} style={{ color: '#818cf8' }} />
                    </button>
                  ))}

                  <button
                    onClick={() => {
                      setShowEventSuggestionModal(false);
                      setShowCreateEventModal(true);
                    }}
                    style={{
                      padding: '1rem 1.25rem', borderRadius: '16px', background: '#6366f1',
                      border: 'none', display: 'flex', alignItems: 'center', gap: '12px',
                      cursor: 'pointer', color: 'white', fontWeight: 800, fontSize: '1rem',
                      boxShadow: '0 10px 25px -5px rgba(99,102,241,0.5)', transition: 'all 0.2s'
                    }}
                  >
                    <Plus size={20} /> Create New Event
                  </button>
                </div>
              </div>

              <div style={{ padding: '1.25rem 2rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowEventSuggestionModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CreateEventModal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        loggedInUserId={loggedInUserId || 0}
        onSuccess={async (newAlbum) => {
          setShowCreateEventModal(false);
          if (detectedUploadContext && detectedUploadContext.uploadedImageIds.length > 0) {
            try {
              await editAlbum(newAlbum.id, loggedInUserId || 0, { itemIds: detectedUploadContext.uploadedImageIds });
              setMessage({ type: 'success', text: `Created event "${newAlbum.title}" with ${detectedUploadContext.uploadedImageIds.length} photos!` });
            } catch (err: any) {
              setMessage({ type: 'error', text: 'Created event but failed to attach photos.' });
            }
          } else {
            setMessage({ type: 'success', text: `Event "${newAlbum.title}" created successfully!` });
          }
        }}
      />

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

      {/* UNIFIED PREMIUM LIGHT-THEMED UPLOAD MODAL */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000
            }}
            onClick={() => {
              if (uploadStep !== 'progress') setShowUploadModal(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              style={{
                background: '#ffffff',
                padding: '2rem',
                borderRadius: '24px',
                width: '92%',
                maxWidth: uploadStep === 'progress' || uploadStep === 'complete' ? '500px' : '580px',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                color: '#0f172a',
                position: 'relative'
              }}
              onClick={e => e.stopPropagation()}
            >
              {uploadStep !== 'progress' && (
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    position: 'absolute', top: '1.25rem', right: '1.25rem',
                    background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748b', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <X size={18} />
                </button>
              )}

              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)',
                  letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.9
                }}>
                  {uploadStep === 'select' && 'Asset Configuration'}
                  {uploadStep === 'progress' && 'Processing Pipeline'}
                  {uploadStep === 'complete' && 'Ingestion Succeeded'}
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a' }}>
                  {uploadStep === 'progress' || uploadStep === 'complete' ? 'Pipeline Hub' : 'Media Ingest Hub'}
                </h2>
              </div>

              {uploadStep === 'select' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* File Selector Drag & Drop */}
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: uploadFiles.length > 0 ? '1.5rem 1rem' : '3rem 2rem',
                      borderRadius: '20px',
                      border: '2px dashed #cbd5e1',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        setUploadFiles(prev => [...prev, ...files]);
                      }}
                      style={{ display: 'none' }}
                    />
                    <div style={{ padding: '10px', background: 'rgba(99,102,241,0.08)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                      <Plus size={22} />
                    </div>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                      {uploadFiles.length > 0 ? 'Add More Photos' : 'Browse Files or Drag & Drop'}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Supports multiple high-res images concurrently</p>
                  </label>

                  {/* Selected Files Queue */}
                  {uploadFiles.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>
                          QUEUED {uploadFiles.length} ASSET{uploadFiles.length !== 1 && 'S'}
                        </span>
                        <button
                          onClick={() => setUploadFiles([])}
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Clear All
                        </button>
                      </div>
                      <div style={{
                        maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px',
                        padding: '8px', borderRadius: '12px', background: '#f1f5f9', border: '1px solid #e2e8f0'
                      }}>
                        {uploadFiles.slice(0, 10).map((file, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%', color: '#334155', fontWeight: 500 }}>
                              {file.name}
                            </span>
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        ))}
                        {uploadFiles.length > 10 && (
                          <div style={{ textAlign: 'center', padding: '6px', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                            + {uploadFiles.length - 10} more files in queue...
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Optional Configuration Fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    
                    {/* Event / Album Name Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>Event / Album Name (Optional)</label>
                      <input
                        placeholder="Type event or album name..."
                        value={eventUploadName}
                        onChange={e => {
                          const val = e.target.value;
                          setEventUploadName(val);
                          setEventUploadSelectedId(null);
                          setShowEventNameSuggestions(true);
                          setEventSuggestActiveIdx(0);
                        }}
                        onKeyDown={e => {
                          const allSuggestions = ingestAlbums.filter(a => a.title && a.title.toLowerCase().includes(eventUploadName.toLowerCase().trim())).slice(0, 5);
                          if (!showEventNameSuggestions || allSuggestions.length === 0) return;
                          if (e.key === 'ArrowDown') { e.preventDefault(); setEventSuggestActiveIdx(i => Math.min(i + 1, allSuggestions.length - 1)); }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setEventSuggestActiveIdx(i => Math.max(i - 1, 0)); }
                          else if (e.key === 'Enter') {
                            e.preventDefault();
                            const s = allSuggestions[eventSuggestActiveIdx];
                            if (s) {
                              setEventUploadName(s.title);
                              setEventUploadSelectedId(s.id);
                              setShowEventNameSuggestions(false);
                            }
                          } else if (e.key === 'Escape') setShowEventNameSuggestions(false);
                        }}
                        onFocus={() => eventUploadName.trim().length >= 2 && setShowEventNameSuggestions(true)}
                        style={{
                          width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px',
                          background: eventUploadSelectedId ? 'rgba(99,102,241,0.06)' : '#ffffff',
                          border: eventUploadSelectedId ? '1px solid #6366f1' : '1px solid #cbd5e1',
                          color: '#0f172a', outline: 'none', fontSize: '0.9rem',
                          transition: 'all 0.2s'
                        }}
                      />
                      {eventUploadSelectedId && (
                        <span style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 700, marginTop: '2px' }}>✓ Adding photos to existing event (ID: {eventUploadSelectedId})</span>
                      )}

                      {/* Smart Autocomplete Dropdown */}
                      {showEventNameSuggestions && eventUploadName.trim().length >= 2 && (() => {
                        const existingMatches = ingestAlbums.filter(a => a.title && a.title.toLowerCase().includes(eventUploadName.toLowerCase().trim())).slice(0, 5);
                        if (existingMatches.length === 0) return null;
                        return (
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
                            background: '#ffffff', border: '1px solid #cbd5e1',
                            borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          }}>
                            {existingMatches.map((album, idx) => (
                              <div
                                key={`ex-${album.id}`}
                                onMouseDown={e => { e.preventDefault(); setEventUploadName(album.title); setEventUploadSelectedId(album.id); setShowEventNameSuggestions(false); }}
                                style={{
                                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                                  background: eventSuggestActiveIdx === idx ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                  color: '#0f172a', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                                  transition: 'background 0.1s'
                                }}
                                onMouseEnter={() => setEventSuggestActiveIdx(idx)}
                              >
                                <span style={{ fontSize: '0.9rem' }}>⭐</span>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{album.title}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{album.items?.length || 0} photos</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Tags Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>TAGS (OPTIONAL, COMMA-SEPARATED)</label>
                      <input
                        placeholder="Ex: goa, travel, beach"
                        value={eventUploadTags}
                        onChange={e => setEventUploadTags(e.target.value)}
                        style={{
                          width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px',
                          background: '#ffffff', border: '1px solid #cbd5e1',
                          color: '#0f172a', outline: 'none', fontSize: '0.9rem',
                          transition: 'all 0.2s'
                        }}
                      />
                    </div>

                  </div>

                  {/* Cancel and Upload Buttons */}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      style={{
                        flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1',
                        background: '#ffffff', color: '#0f172a', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeBulkUpload}
                      disabled={uploadFiles.length === 0}
                      className="btn btn-primary"
                      style={{
                        flex: 2, padding: '0.85rem', borderRadius: '12px',
                        cursor: uploadFiles.length > 0 ? 'pointer' : 'not-allowed', opacity: uploadFiles.length > 0 ? 1 : 0.5,
                        fontSize: '0.92rem', fontWeight: 700
                      }}
                    >
                      Upload {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
                    </button>
                  </div>
                </div>
              )}

              {uploadStep === 'progress' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '1rem 0' }}>
                  <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                    <div className="loading-spinner" style={{ width: '70px', height: '70px', borderTopColor: 'var(--primary)', borderWidth: '4px', position: 'absolute' }}></div>
                    <div className="loading-spinner" style={{ width: '46px', height: '46px', borderTopColor: '#cbd5e1', borderWidth: '3px', margin: '12px', position: 'absolute', animationDirection: 'reverse' }}></div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      {bulkUploadProgress.phase === 'uploading' && 'Streaming Assets...'}
                      {bulkUploadProgress.phase === 'scanning' && 'Running Face Recognition...'}
                      {bulkUploadProgress.phase === 'metadata' && 'Context Extraction...'}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                      {bulkUploadProgress.phase === 'uploading' && `Transmitting ${bulkUploadProgress.total} items to server...`}
                      {bulkUploadProgress.phase === 'scanning' && `Resolved ${bulkUploadProgress.count} / ${bulkUploadProgress.total} items`}
                      {bulkUploadProgress.phase === 'metadata' && `Generated ${bulkUploadProgress.count} / ${bulkUploadProgress.total} profiles`}
                    </p>
                  </div>

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                      <motion.div
                        style={{
                          height: '100%', borderRadius: '99px',
                          background: 'linear-gradient(90deg, #6366f1, #818cf8, #a78bfa)'
                        }}
                        animate={{ width: `${bulkUploadProgress.percent}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
                      <span>UPLOADING</span>
                      <span>{bulkUploadProgress.percent}%</span>
                    </div>
                  </div>
                </div>
              )}

              {uploadStep === 'complete' && bulkUploadSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
                    <div style={{
                      width: '60px', height: '60px', borderRadius: '50%', background: '#e6f4ea',
                      color: '#137333', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <CheckCircle2 size={30} />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Ingestion Complete</h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                      All items have been mapped, scanned, and enriched.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Assets Created</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                        {bulkUploadSummary.uploadedCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>photos</span>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Anchor Node</span>
                      <div style={{
                        fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5', marginTop: '0.5rem',
                        textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                      }}>
                        {bulkUploadSummary.albumId ? `Album: "${bulkUploadSummary.eventName || 'Event'}"` : 'Global Flow'}
                      </div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Faces Resolved</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                        {bulkUploadSummary.facesCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>identities</span>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Analytical Indexing</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
                        {bulkUploadSummary.metaCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>items</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      style={{
                        flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1',
                        background: '#ffffff', color: '#0f172a', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                    {bulkUploadSummary.albumId ? (
                      <button
                        onClick={() => {
                          setShowUploadModal(false);
                          navigate(`/albums/${bulkUploadSummary.albumId}`);
                        }}
                        className="btn btn-primary"
                        style={{
                          flex: 2, padding: '0.85rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                      >
                        <Eye size={16} /> Navigate to Album
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowUploadModal(false)}
                        className="btn btn-primary"
                        style={{ flex: 2, padding: '0.85rem', borderRadius: '12px' }}
                      >
                        View Discoveries
                      </button>
                    )}
                  </div>
                </div>
              )}
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


