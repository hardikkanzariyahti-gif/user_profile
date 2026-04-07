import { useEffect, useRef, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

export default function UpdatePage() {
  const [updateUserId, setUpdateUserId] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [updateEmail, setUpdateEmail] = useState('');
  const [updateFile, setUpdateFile] = useState(null);
  const [isUpdateFormOpen, setIsUpdateFormOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'

  const [currentUser, setCurrentUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [isProfileVisible, setIsProfileVisible] = useState(false);

  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [idLookupQuery, setIdLookupQuery] = useState('');
  const [idLookupResults, setIdLookupResults] = useState([]);
  const [isLookingUpId, setIsLookingUpId] = useState(false);

  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const profileHideTimerRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!message || messageType !== 'success') return undefined;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  useEffect(() => () => {
    if (profileHideTimerRef.current) window.clearTimeout(profileHideTimerRef.current);
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
  }, [cameraStream]);

  const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
  const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

  const resetUpdateForm = (keepUserId = true) => {
    setUpdateName('');
    setUpdateEmail('');
    setUpdateFile(null);
    setIsUpdateFormOpen(false);
    if (!keepUserId) setUpdateUserId('');
  };

  const scheduleProfileHide = () => {
    if (profileHideTimerRef.current) window.clearTimeout(profileHideTimerRef.current);
    profileHideTimerRef.current = window.setTimeout(() => setIsProfileVisible(false), 3000);
  };

  const loadUserForUpdate = async () => {
    if (!updateUserId.trim()) {
      setMessage('Please enter a User ID to load');
      setMessageType('error');
      return;
    }

    try {
      setIsLoadingUser(true);
      setMessage('Searching user...');
      setMessageType('info');

      const res = await fetch(`${API_BASE}/users/${updateUserId}`);
      const user = await res.json();
      if (!res.ok) throw new Error(user.message || 'User not found');

      setCurrentUser(user);
      setProfilePicture(user.profilePicture || null);
      setIsProfileVisible(true);

      setUpdateName(user.name || '');
      setUpdateEmail(user.email || '');
      setUpdateFile(null);
      setIsUpdateFormOpen(true);

      setMessage('✓ User data loaded for editing');
      setMessageType('success');
    } catch (e) {
      setMessage(`❌ ${e.message}`);
      setMessageType('error');
      resetUpdateForm();
      setIsProfileVisible(false);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const updateUser = async (e) => {
    e.preventDefault();
    if (isUpdating) return;
    if (!updateUserId.trim()) {
      setMessage('Please enter a User ID');
      setMessageType('error');
      return;
    }

    const normalizedName = normalizeName(updateName);
    const normalizedEmail = normalizeEmail(updateEmail);

    if (!normalizedName || !normalizedEmail) {
      setMessage('Please fill in name and email before updating');
      setMessageType('error');
      return;
    }
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setMessage('Name must be between 2 and 80 characters');
      setMessageType('error');
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }

    const form = new FormData();
    form.append('name', normalizedName);
    form.append('email', normalizedEmail);
    if (updateFile) form.append('profilePicture', updateFile);

    try {
      setIsUpdating(true);
      const res = await fetch(`${API_BASE}/users/${updateUserId}`, { method: 'PUT', body: form });
      const updated = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(`❌ ${updated.message || 'Failed to update profile'}`);
        setMessageType('error');
        return;
      }

      setCurrentUser(updated);
      setProfilePicture(updated.profilePicture || null);
      setIsProfileVisible(true);
      try {
        window.localStorage.setItem('loggedInUser', JSON.stringify(updated));
      } catch {
        // ignore
      }

      resetUpdateForm();
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      scheduleProfileHide();

      setMessage('✓ Profile updated successfully!');
      setMessageType('success');
    } catch (e) {
      setMessage(`❌ Update failed: ${e.message}`);
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  const lookupUserId = async () => {
    const q = idLookupQuery.trim().toLowerCase();
    if (!q) {
      setMessage('Enter a name or email to search');
      setMessageType('error');
      return;
    }

    try {
      setIsLookingUpId(true);
      setMessage('Searching users...');
      setMessageType('info');

      const res = await fetch(`${API_BASE}/users?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.message || 'Failed to search users');

      const matches = Array.isArray(data) ? data : [];

      setIdLookupResults(matches);
      if (matches.length === 0) {
        setMessage('No matching users found');
        setMessageType('info');
      } else {
        setMessage(`Found ${matches.length} user(s). Select one to fill the ID.`);
        setMessageType('success');
      }
    } catch (e) {
      setMessage(`❌ Search failed: ${e.message}`);
      setMessageType('error');
    } finally {
      setIsLookingUpId(false);
    }
  };

  const selectLookupResult = (user) => {
    if (!user?.id) return;
    setUpdateUserId(String(user.id));
    setIdLookupResults([]);
    resetUpdateForm();
    setMessage('ID filled. Click "Load User" to edit.');
    setMessageType('success');
  };

  const startCameraUpdate = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setMessage('📷 Camera started for update. Click "Capture Photo" to take a picture.');
      setMessageType('info');
    } catch {
      setMessage('❌ Camera access denied or not available');
      setMessageType('error');
    }
  };

  const captureImageUpdate = () => {
    if (!cameraStream || !videoRef.current) {
      setMessage('❌ Please start the camera first.');
      setMessageType('error');
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setMessage('📷 Camera is warming up. Please wait a moment and try again.');
      setMessageType('info');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage('❌ Failed to capture image');
        setMessageType('error');
        return;
      }

      const capturedFile = new File([blob], 'captured-profile-update.jpg', { type: 'image/jpeg' });
      setUpdateFile(capturedFile);
      setMessage('✅ Photo captured for update! Ready to save changes.');
      setMessageType('success');

      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }, 'image/jpeg');
  };

  const stopCameraUpdate = () => {
    if (!cameraStream) return;
    cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  };

  const updatedAtLabel =
    currentUser?.updatedAt && !Number.isNaN(new Date(currentUser.updatedAt).getTime())
      ? new Date(currentUser.updatedAt).toLocaleDateString()
      : 'Not available';

  return (
    <>
      {message && <p className={`message ${messageType}`}>{message}</p>}

      {currentUser && isProfileVisible && (
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
              <span className="info-value">{updatedAtLabel}</span>
            </div>
          </div>
        </section>
      )}

      <form onSubmit={updateUser} className="card">
        <h2>✏️ Update Existing Profile</h2>

        <div className="form-group">
          <label htmlFor="idLookup">Forgot your ID? Search by name or email</label>
          <div className="inline-action">
            <input
              id="idLookup"
              value={idLookupQuery}
              onChange={(e) => setIdLookupQuery(e.target.value)}
              placeholder="Type name or email"
              type="text"
              className="inline-action-input"
            />
            <button
              type="button"
              onClick={lookupUserId}
              className="secondary-button inline-action-button"
              disabled={isLookingUpId}
            >
              {isLookingUpId ? 'Searching...' : 'Search'}
            </button>
          </div>

          {idLookupResults.length > 0 && (
            <div className="lookup-results" role="list">
              {idLookupResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="lookup-item"
                  onClick={() => selectLookupResult(u)}
                >
                  <span className="lookup-main">
                    <span className="lookup-name">{u.name || 'Unnamed'}</span>
                    <span className="lookup-email">{u.email || ''}</span>
                  </span>
                  <span className="lookup-id">ID: {u.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="updateUserId">User ID to Update</label>
          <div className="inline-action">
            <input
              id="updateUserId"
              value={updateUserId}
              onChange={(e) => {
                setUpdateUserId(e.target.value);
                resetUpdateForm();
              }}
              placeholder="Enter user ID"
              type="text"
              className="inline-action-input"
              required
            />
            <button
              type="button"
              onClick={loadUserForUpdate}
              className="secondary-button inline-action-button"
              disabled={isLoadingUser}
            >
              {isLoadingUser ? 'Searching...' : 'Load User'}
            </button>
          </div>
        </div>

        {isUpdateFormOpen && (
          <>
            <div className="form-group">
              <label htmlFor="updateName">Name</label>
              <input
                id="updateName"
                value={updateName}
                onChange={(e) => setUpdateName(e.target.value)}
                placeholder="Update name"
                type="text"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="updateEmail">Email</label>
              <input
                id="updateEmail"
                value={updateEmail}
                onChange={(e) => setUpdateEmail(e.target.value)}
                placeholder="Update email"
                type="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="updateFile">Update Profile Picture (Optional)</label>
              <input
                id="updateFile"
                type="file"
                accept="image/*"
                onChange={(e) => setUpdateFile(e.target.files[0] || null)}
              />

              {updateFile && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--success)' }}>
                  ✓ {updateFile.name}
                </p>
              )}

              <div className="camera-box">
                <p className="camera-title">Or capture new photo from camera:</p>
                <div className="camera-actions">
                  <button type="button" onClick={startCameraUpdate} className="camera-btn success">
                    📷 Start Camera
                  </button>
                  <button type="button" onClick={stopCameraUpdate} className="camera-btn danger">
                    ⏹️ Stop Camera
                  </button>
                  <button type="button" onClick={captureImageUpdate} className="camera-btn warn">
                    📸 Capture Photo
                  </button>
                </div>

                {cameraStream && (
                  <div style={{ marginTop: '1rem' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        maxWidth: '400px',
                        height: 'auto',
                        borderRadius: '8px',
                        border: '2px solid #E5E7EB',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Profile'}
            </button>
          </>
        )}
      </form>
    </>
  );
}
