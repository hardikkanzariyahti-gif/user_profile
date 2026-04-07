import { useEffect, useRef, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

export default function CreatePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'

  const [currentUser, setCurrentUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);

  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!message || messageType !== 'success') return undefined;
    const timer = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  useEffect(() => () => {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
  }, [cameraStream]);

  const normalizeName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
  const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

  const createUser = async (e) => {
    e.preventDefault();
    if (isCreating) return;

    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedName || !normalizedEmail) {
      setMessage('Please fill in all required fields');
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
    if (file) form.append('profilePicture', file);

    try {
      setIsCreating(true);
      const res = await fetch(`${API_BASE}/users`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(`❌ ${data.message || 'Failed to create profile'}`);
        setMessageType('error');
        return;
      }

      setCurrentUser(data);
      setProfilePicture(data.profilePicture || null);
      setFile(null);
      try {
        window.localStorage.setItem('loggedInUser', JSON.stringify(data));
      } catch {
        // ignore
      }

      if (data?.existing) {
        setMessage(`✓ Profile already exists. ID: ${data.id}`);
      } else {
        setMessage(`✓ Profile created successfully! ID: ${data.id}`);
      }
      setMessageType('success');
    } catch (err) {
      setMessage(`❌ Create failed: ${err.message}`);
      setMessageType('error');
    } finally {
      setIsCreating(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setMessage('📷 Camera started. Click "Capture Photo" to take a picture.');
      setMessageType('info');
    } catch {
      setMessage('❌ Camera access denied or not available');
      setMessageType('error');
    }
  };

  const stopCamera = () => {
    if (!cameraStream) return;
    cameraStream.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setMessage('📷 Camera stopped.');
    setMessageType('info');
  };

  const captureImage = () => {
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

      const capturedFile = new File([blob], 'captured-profile.jpg', { type: 'image/jpeg' });
      setFile(capturedFile);
      setMessage('✅ Photo captured! Ready to create profile.');
      setMessageType('success');
      stopCamera();
    }, 'image/jpeg');
  };

  const updatedAtLabel =
    currentUser?.updatedAt && !Number.isNaN(new Date(currentUser.updatedAt).getTime())
      ? new Date(currentUser.updatedAt).toLocaleDateString()
      : 'Not available';

  return (
    <>
      {message && <p className={`message ${messageType}`}>{message}</p>}

      <form onSubmit={createUser} className="card">
        <h2>🚀 Create New User Profile</h2>

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            type="text"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="file">Profile Picture (Optional)</label>
          <input
            id="file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />

          {file && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--success)' }}>
              ✓ {file.name}
            </p>
          )}

          <div className="camera-box">
            <p className="camera-title">Or capture from camera:</p>
            <div className="camera-actions">
              <button type="button" onClick={startCamera} className="camera-btn success">
                📷 Start Camera
              </button>
              <button type="button" onClick={stopCamera} className="camera-btn danger">
                ⏹️ Stop Camera
              </button>
              <button type="button" onClick={captureImage} className="camera-btn warn">
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

        <button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Profile'}
        </button>
      </form>

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
              <span className="info-value">{updatedAtLabel}</span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
