import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Tag, FileText, Sparkles } from 'lucide-react';
import { createAlbum, fetchAlbums } from '../services/albumService';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAlbum: any) => void;
  loggedInUserId?: number;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, onSuccess, loggedInUserId = 0 }) => {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState(''); // Category is now optional and custom text
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart suggestions state
  const [existingAlbums, setExistingAlbums] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setEventType('');
      setDate('');
      setLocation('');
      setDescription('');
      setError(null);
      setShowSuggestions(false);
      setActiveSuggestionIndex(0);

      fetchAlbums(loggedInUserId || 0)
        .then(data => setExistingAlbums(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isOpen, loggedInUserId]);

  // Suggestions must show ONLY real existing event/album names from database.
  const suggestions = useMemo(() => {
    if (!title.trim()) return [];
    const query = title.toLowerCase().trim();
    const result: { type: 'existing'; text: string; data?: any }[] = [];

    existingAlbums.forEach(album => {
      if (album.title && album.title.toLowerCase().includes(query)) {
        if (!result.some(r => r.text.toLowerCase() === album.title.toLowerCase())) {
          result.push({
            type: 'existing',
            text: album.title,
            data: album
          });
        }
      }
    });

    return result.slice(0, 6);
  }, [title, existingAlbums]);

  if (!isOpen) return null;

  const handleSelectSuggestion = (sug: typeof suggestions[0]) => {
    if (sug.type === 'existing' && sug.data) {
      onSuccess(sug.data);
      return;
    }
    setTitle(sug.text);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = suggestions[activeSuggestionIndex];
      if (selected) {
        handleSelectSuggestion(selected);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    // If event name is empty, assign a default timestamped title
    let finalTitle = title.trim();
    if (!finalTitle) {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      finalTitle = `Event - ${dateStr}`;
    }

    try {
      const payload = {
        title: finalTitle,
        eventType: eventType.trim() || 'Custom', // fallback category if empty
        date: date.trim(),
        location: location.trim(),
        description: description.trim(),
        userId: loggedInUserId || undefined, // completely optional
        itemIds: [],
        isGlobal: true
      };

      const newAlbum = await createAlbum(payload);
      setLoading(false);
      onSuccess(newAlbum);
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem', zIndex: 3000
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 10, opacity: 0 }}
          style={{
            width: '100%', maxWidth: '520px',
            background: '#ffffff',
            borderRadius: '24px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
            overflow: 'visible',
            display: 'flex', flexDirection: 'column'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1.5rem 1.75rem', borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc', borderTopLeftRadius: '24px', borderTopRightRadius: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.08)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                Create New Event
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#64748b', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'visible' }}>
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                {error}
              </div>
            )}

            {/* 1. Event Name with Smart Autocomplete */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
              <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Event / Album Name (Optional)
              </label>
              <input
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  setShowSuggestions(true);
                  setActiveSuggestionIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type event or album name..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: '#ffffff', border: '1px solid #cbd5e1',
                  color: '#0f172a', fontSize: '0.95rem', fontWeight: 600, outline: 'none', transition: 'all 0.2s'
                }}
                onFocus={() => {
                  if (title.trim()) setShowSuggestions(true);
                }}
              />

              {/* Autocomplete Dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                      background: '#ffffff', border: '1px solid #cbd5e1',
                      borderRadius: '12px', overflow: 'hidden', zIndex: 3500,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                    }}
                  >
                    {suggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(sug)}
                        onMouseEnter={() => setActiveSuggestionIndex(idx)}
                        style={{
                          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                          background: activeSuggestionIndex === idx ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          color: '#0f172a',
                          cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                          borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}
                      >
                        <Sparkles size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                          {sug.text}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Event Type & 3. Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={14} style={{ color: '#6366f1' }} /> Category (Optional)
                </label>
                <input
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                  placeholder="e.g. Vacation, Festival"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    background: '#ffffff', border: '1px solid #cbd5e1',
                    color: '#0f172a', fontSize: '0.95rem', fontWeight: 600, outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} style={{ color: '#6366f1' }} /> Date (Optional)
                </label>
                <input
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  placeholder="e.g. May 2026"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    background: '#ffffff', border: '1px solid #cbd5e1',
                    color: '#0f172a', fontSize: '0.95rem', outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* 4. Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ color: '#6366f1' }} /> Location (Optional)
              </label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Goa, Ahmedabad"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: '#ffffff', border: '1px solid #cbd5e1',
                  color: '#0f172a', fontSize: '0.95rem', outline: 'none'
                }}
              />
            </div>

            {/* 5. Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} style={{ color: '#6366f1' }} /> Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief notes or context..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 12,
                  background: '#ffffff', border: '1px solid #cbd5e1',
                  color: '#0f172a', fontSize: '0.95rem', outline: 'none', resize: 'none'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '10px 20px', borderRadius: 12, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '10px 24px', borderRadius: 12, background: '#6366f1', border: 'none', color: 'white', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Create Event'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
};
