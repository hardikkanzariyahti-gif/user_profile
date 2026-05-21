import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Hash, Box, MapPin, Type, X } from 'lucide-react';

const API_URL = '/api';

export const MiniSearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (q: string) => {
    if (!q.trim()) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/gallery/suggestions?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search network response was not ok');
      const data = await res.json();
      setSuggestions(data || []);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 250);

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [query]);

  const handleSelect = (item: any) => {
    setIsOpen(false);
    setQuery('');
    if (item.type === 'person') {
      // Filter gallery by person name
      navigate(`/gallery?search=${encodeURIComponent(item.value)}`);
    } else if (item.type === 'hashtag') {
      navigate(`/tags/${encodeURIComponent(item.value)}`);
    } else {
      // Objects, Scenes, OCR directly pass as query search to gallery
      navigate(`/gallery?search=${encodeURIComponent(item.value)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      setIsOpen(false);
      navigate(`/gallery?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'person': return <User size={14} className="suggestion-icon-person" />;
      case 'hashtag': return <Hash size={14} className="suggestion-icon-tag" />;
      case 'object': return <Box size={14} className="suggestion-icon-obj" />;
      case 'scene': return <MapPin size={14} className="suggestion-icon-scene" />;
      case 'ocr': return <Type size={14} className="suggestion-icon-ocr" />;
      default: return <Search size={14} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'person': return 'Person';
      case 'hashtag': return 'Tag';
      case 'object': return 'Object';
      case 'scene': return 'Scene';
      case 'ocr': return 'Text';
      default: return 'Result';
    }
  };

  return (
    <div ref={containerRef} className="mini-search-container">
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search photos, tags, people..."
          className="mini-search-input"
        />
        {query && (
          <button 
            className="clear-search-btn" 
            onClick={() => { setQuery(''); setSuggestions([]); setIsOpen(false); }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (query.trim().length > 0) && (
        <div className="search-dropdown glass-panel">
          {isLoading && suggestions.length === 0 ? (
             <div className="search-status-item">Searching...</div>
          ) : suggestions.length > 0 ? (
            <div className="search-suggestions-list">
              {suggestions.map((item, i) => (
                <button 
                  key={`${item.type}-${i}`} 
                  className="suggestion-item"
                  onClick={() => handleSelect(item)}
                >
                  <div className={`suggestion-icon-wrapper type-${item.type}`}>
                    {getIconForType(item.type)}
                  </div>
                  <div className="suggestion-info">
                    <div className="suggestion-value">{item.value}</div>
                    <div className="suggestion-type">{getTypeLabel(item.type)}</div>
                  </div>
                </button>
              ))}
              
              <button 
                className="suggestion-item search-all-link"
                onClick={() => { setIsOpen(false); navigate(`/gallery?search=${encodeURIComponent(query)}`); }}
              >
                <div className="suggestion-icon-wrapper">
                  <Search size={14} />
                </div>
                <div className="suggestion-info">
                  <div className="suggestion-value">Search for "{query}"</div>
                  <div className="suggestion-type">View all gallery matches</div>
                </div>
              </button>
            </div>
          ) : !isLoading ? (
            <div className="search-suggestions-list">
              <button 
                className="suggestion-item search-all-link"
                onClick={() => { setIsOpen(false); navigate(`/gallery?search=${encodeURIComponent(query)}`); }}
              >
                <div className="suggestion-icon-wrapper">
                  <Search size={14} />
                </div>
                <div className="suggestion-info">
                  <div className="suggestion-value">Search "{query}"</div>
                  <div className="suggestion-type">No quick suggestions found</div>
                </div>
              </button>
            </div>
          ) : null}
        </div>
      )}

      <style>{`
        .mini-search-container {
          position: relative;
          width: 280px;
          margin: 0 1rem;
          z-index: 1000;
        }
        @media (max-width: 768px) {
          .mini-search-container {
            width: 100%;
            margin: 0.5rem 0;
          }
        }
        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
        }
        .clear-search-btn {
          position: absolute;
          right: 12px;
          background: rgba(0,0,0,0.05);
          border: none;
          color: var(--text-muted);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          transition: all 0.2s;
        }
        .clear-search-btn:hover {
          background: rgba(0,0,0,0.1);
          color: var(--text-main);
        }
        .mini-search-input {
          width: 100%;
          height: 42px;
          padding: 0 36px 0 38px;
          border-radius: 99px;
          border: 1px solid var(--border-color);
          background: #f3f4f6;
          color: var(--text-main);
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mini-search-input:focus {
          background: white;
          border-color: var(--primary, #6366f1);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        .mini-search-input::placeholder {
          color: #9ca3af;
        }
        
        .search-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          min-width: 300px;
          background: rgba(20, 21, 27, 0.85);
          backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);
          overflow: hidden;
          animation: dropdownSlide 0.2s ease-out;
        }
        
        @keyframes dropdownSlide {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        .search-status-item {
          padding: 12px;
          text-align: center;
          color: rgba(255,255,255,0.5);
          font-size: 0.85rem;
          font-style: italic;
        }

        .search-suggestions-list {
          display: flex;
          flex-direction: column;
          padding: 6px;
          max-height: 350px;
          overflow-y: auto;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          border-radius: 10px;
          cursor: pointer;
          color: white;
          transition: background 0.2s;
        }

        .suggestion-item:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .suggestion-icon-wrapper {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.6);
          flex-shrink: 0;
        }
        
        .type-person .suggestion-icon-wrapper { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
        .type-hashtag .suggestion-icon-wrapper { background: rgba(236, 72, 153, 0.15); color: #f472b6; }
        .type-object .suggestion-icon-wrapper { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
        .type-scene .suggestion-icon-wrapper { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .type-ocr .suggestion-icon-wrapper { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }

        .suggestion-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .suggestion-value {
          font-size: 0.9rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: capitalize;
        }
        .type-hashtag .suggestion-value {
          text-transform: none;
        }

        .suggestion-type {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.4);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .search-all-link {
          margin-top: 4px;
          border-top: 1px solid rgba(255,255,255,0.06);
          border-radius: 0 0 8px 8px;
          padding-top: 12px;
        }
        .search-all-link .suggestion-icon-wrapper {
           background: rgba(99, 102, 241, 0.2);
           color: white;
        }
      `}</style>
    </div>
  );
};
