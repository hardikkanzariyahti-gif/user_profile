import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';

function normalizeTag(input: string): string {
  const trimmed = (input || '').trim().replace(/^#+/, '').toLowerCase();
  return trimmed.replace(/[^a-z0-9_-]/g, '').slice(0, 40);
}

export default function Search() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  const normalized = useMemo(() => normalizeTag(value), [value]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) return;
    navigate(`/tags/${encodeURIComponent(normalized)}`);
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div className="card">
        <h2 className="card-title" style={{ fontSize: '2rem', fontWeight: 800 }}>Search by hashtag</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Type a tag (example: <span style={{ fontWeight: 800 }}>#wedding</span>) and open results.</p>

        <form onSubmit={submit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="#party"
            style={{ flex: '1 1 280px', minWidth: 240 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!normalized} style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
            <SearchIcon size={18} /> Search
          </button>
        </form>

        {value && !normalized && (
          <p style={{ marginTop: '0.75rem', color: 'var(--error)', fontWeight: 700 }}>Enter a valid tag (letters/numbers/underscore/hyphen).</p>
        )}
      </div>
    </div>
  );
}

