import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'

  const [users, setUsers] = useState([]);
  const [usersQuery, setUsersQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('loggedInUser');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.id) {
        setCurrentUser(parsed);
        setProfilePicture(parsed.profilePicture || null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!message || messageType !== 'success') return undefined;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

  const formatDate = (raw) => {
    const d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  const getUpdatedAtLabel = (user) => {
    const value = user?.updatedAt ?? user?.updated_at ?? user?.createdAt ?? user?.created_at;
    return formatDate(value);
  };

  const performLogin = async (rawEmail) => {
    if (isLoggingIn) return false;

    const normalizedEmail = normalizeEmail(rawEmail);
    if (!normalizedEmail) {
      setMessage('Please enter your email');
      setMessageType('error');
      return false;
    }
    if (!isValidEmail(normalizedEmail)) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return false;
    }

    try {
      setIsLoggingIn(true);
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Login failed');

      setCurrentUser(data);
      setProfilePicture(data.profilePicture || null);
      try {
        window.localStorage.setItem('loggedInUser', JSON.stringify(data));
      } catch {
        // ignore
      }

      setMessage('✓ Logged in successfully');
      setMessageType('success');
      return true;
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setMessageType('error');
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    await performLogin(email);
  };

  const logout = () => {
    setCurrentUser(null);
    setProfilePicture(null);
    try {
      window.localStorage.removeItem('loggedInUser');
    } catch {
      // ignore
    }
    setMessage('Logged out');
    setMessageType('info');
  };

  const fetchUsers = async ({ q } = {}) => {
    try {
      setIsLoadingUsers(true);
      const query = String(q ?? '').trim();
      const url = new URL(`${API_BASE}/users`);
      url.searchParams.set('limit', '50');
      if (query) url.searchParams.set('q', query);

      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.message || 'Failed to fetch users');

      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      return list;
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setMessageType('error');
      setUsers([]);
      return [];
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchUsers({ q: usersQuery });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersQuery]);

  return (
    <>
      {message && <p className={`message ${messageType}`}>{message}</p>}

      <form onSubmit={login} className="card">
        <h2>🔐 Login</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Enter your email to view your profile. New user? Create a profile from the Create tab.
        </p>

        <div className="form-group">
          <label htmlFor="loginEmail">Email Address</label>
          <input
            id="loginEmail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
          {currentUser && (
            <button type="button" className="secondary-button" onClick={logout}>
              Logout
            </button>
          )}
        </div>
      </form>

      <section className="card">
        <div className="card-header-row">
          <div>
            <h2 style={{ marginBottom: '0.35rem' }}>📋 All Users</h2>
            <p className="subtitle" style={{ textAlign: 'left', marginBottom: 0 }}>
              Browse all users (search by name or email). Click “Login” to open a profile.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            style={{ width: 'auto', alignSelf: 'flex-start' }}
            onClick={() => fetchUsers({ q: usersQuery })}
            disabled={isLoadingUsers}
          >
            {isLoadingUsers ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="usersSearch">Search</label>
          <div className="inline-action">
            <input
              id="usersSearch"
              value={usersQuery}
              onChange={(e) => setUsersQuery(e.target.value)}
              placeholder="Type name or email"
              type="text"
              className="inline-action-input"
            />
            <button
              type="button"
              className="secondary-button inline-action-button"
              onClick={() => fetchUsers({ q: usersQuery })}
              disabled={isLoadingUsers}
            >
              {isLoadingUsers ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        <div className="users-meta">
          <span>{isLoadingUsers ? 'Loading users…' : `Showing ${users.length} user(s)`}</span>
        </div>

        {users.length === 0 && !isLoadingUsers ? (
          <div className="empty-state" style={{ padding: '1.25rem' }}>
            <div className="empty-state-icon">🧾</div>
            <p>No users found</p>
          </div>
        ) : (
          <div className="users-list" role="list">
            {users.map((u) => (
              <div key={u.id} className="user-row" role="listitem">
                <div className="user-row-main">
                  {u.profilePicture ? (
                    <img className="user-avatar" src={u.profilePicture} alt={u.name || 'User'} />
                  ) : (
                    <div className="user-avatar user-avatar-placeholder" aria-hidden="true">
                      👤
                    </div>
                  )}

                  <div className="user-row-text">
                    <div className="user-row-title">
                      <span className="user-name">{u.name || 'Unnamed'}</span>
                      <span className="user-id-pill">ID: {u.id}</span>
                    </div>
                    <div className="user-row-sub">
                      <span className="user-email">{u.email || '—'}</span>
                      <span className="user-updated">Updated: {getUpdatedAtLabel(u)}</span>
                    </div>
                  </div>
                </div>

                <div className="user-row-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ width: 'auto' }}
                    disabled={!u.email || isLoggingIn}
                    onClick={async () => {
                      setEmail(u.email || '');
                      await performLogin(u.email);
                    }}
                  >
                    Login
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {currentUser && (
        <section className="card">
          <h2>👋 Your Profile</h2>
          <div className="profile-section">
            {profilePicture ? (
              <div className="profile-img-container">
                <img src={profilePicture} alt={currentUser.name} className="profile-img" />
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <p>No profile picture yet</p>
              </div>
            )}
          </div>

          <div className="user-info">
            <div className="info-item">
              <span className="info-label">User ID</span>
              <span className="info-value">{currentUser.id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{currentUser.name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email</span>
              <span className="info-value">{currentUser.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Last Updated</span>
              <span className="info-value">{getUpdatedAtLabel(currentUser)}</span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
