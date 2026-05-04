import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Hash, ArrowRight } from 'lucide-react';
import { fetchAllHashtags } from '../services/galleryService';

function normalizeTag(input: string): string {
  const trimmed = (input || '').trim().replace(/^#+/, '').toLowerCase();
  return trimmed.replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

export default function Search() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllHashtags().then(setHashtags).catch(console.error);
  }, []);

  const normalized = useMemo(() => normalizeTag(value), [value]);

  const filteredSuggestions = useMemo(() => {
    if (!normalized) return [];
    return hashtags.filter(h => h.startsWith(normalized) && h !== normalized).slice(0, 8);
  }, [hashtags, normalized]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) return;
    navigate(`/tags/${encodeURIComponent(normalized)}`);
  };

  const selectSuggestion = (tag: string) => {
    setValue(`#${tag}`);
    setShowSuggestions(false);
    navigate(`/tags/${encodeURIComponent(tag)}`);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div className="card">
        <h2 className="card-title" style={{ fontSize: '2rem', fontWeight: 800 }}>Search by hashtag</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Type a tag (example: <span style={{ fontWeight: 800 }}>#wedding</span>) and open results.</p>

        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <form onSubmit={submit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <input
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="#party"
                style={{ width: '100%', paddingLeft: value.startsWith('#') ? '2rem' : '1rem' }}
              />
              {value.startsWith('#') && (
                <Hash size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={!normalized} style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
              <SearchIcon size={18} /> Search
            </button>
          </form>

          {showSuggestions && (normalized || filteredSuggestions.length > 0) && (
            <div className="card" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              marginTop: '0.5rem',
              padding: '0.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid var(--border)',
              maxHeight: '350px',
              overflowY: 'auto',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(-10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              <div
                onClick={submit}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  marginBottom: '0.25rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.color = 'inherit';
                }}
              >
                <SearchIcon size={16} />
                <span style={{ fontWeight: 600 }}>Search for <span style={{ opacity: 0.8 }}>#{normalized}</span></span>
              </div>

              {filteredSuggestions.length > 0 && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0.5rem 0' }} />
                  <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0.25rem 0.75rem', fontWeight: 800 }}>Matching Hashtags</p>
                  {filteredSuggestions.map(tag => (
                    <div
                      key={tag}
                      onClick={() => selectSuggestion(tag)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.2s',
                        fontWeight: 500
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Hash size={16} style={{ color: 'var(--primary)', opacity: 0.7 }} />
                        {tag}
                      </span>
                      <ArrowRight size={14} style={{ opacity: 0.3 }} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {value && !normalized && (
          <p style={{ marginTop: '0.75rem', color: 'var(--error)', fontWeight: 700 }}>Enter a valid tag (letters/numbers/underscore/hyphen).</p>
        )}
      </div>

      {hashtags.length > 0 && !value && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Popular Hashtags</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {hashtags.slice(0, 15).map(tag => (
              <button
                key={tag}
                onClick={() => navigate(`/tags/${encodeURIComponent(tag)}`)}
                className="btn"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '2rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Hash size={14} style={{ color: 'var(--primary)' }} />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
