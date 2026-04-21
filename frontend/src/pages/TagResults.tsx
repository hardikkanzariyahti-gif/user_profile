import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react';
import { searchGalleryByHashtag } from '../services/galleryService';

interface GalleryItem {
  id: number;
  url: string;
  uploadedAt?: string;
  isProfile?: boolean;
  recognizedUsers?: { id: number; name: string; profilePicture?: string | null }[];
  hashtags?: string[];
}

function displayTag(tag: string): string {
  return `#${tag}`;
}

export default function TagResults() {
  const { tag = '' } = useParams();
  const navigate = useNavigate();
  const normalizedTag = useMemo(() => String(tag || '').toLowerCase(), [tag]);

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchGalleryByHashtag(normalizedTag);
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Search failed.');
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [normalizedTag]);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div className="mb-8" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ padding: '0.6rem 1rem' }}>
            <ArrowLeft size={18} /> Back
          </button>
          <h2 className="card-title" style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 0 }}>{displayTag(normalizedTag)}</h2>
        </div>
        <Link to="/search" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          <SearchIcon size={18} /> New search
        </Link>
      </div>

      {loading ? (
        <div className="text-center p-20"><div className="loading-spinner" style={{ margin: '0 auto', borderTopColor: 'var(--primary)' }} /></div>
      ) : error ? (
        <div className="card"><p style={{ color: 'var(--error)', fontWeight: 800 }}>{error}</p></div>
      ) : items.length === 0 ? (
        <div className="card"><p className="text-muted">No photos found for this hashtag.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {items.map((img) => (
            <div key={img.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ position: 'relative', background: '#000' }}>
                <img src={img.url} alt="Result" style={{ width: '100%', height: 220, objectFit: 'cover', opacity: 0.92 }} />
                <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(img.hashtags || []).slice(0, 3).map((t) => (
                    <span key={t} style={{ background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.18)', padding: '4px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800 }}>
                      {displayTag(t)}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ padding: '1rem' }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recognized</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  {img.recognizedUsers && img.recognizedUsers.length > 0 ? (
                    img.recognizedUsers.slice(0, 4).map((u) => (
                      <span key={u.id} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.22)', color: 'var(--text-main)', padding: '4px 10px', borderRadius: 999, fontWeight: 800, fontSize: '0.8rem' }}>
                        {u.name}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

