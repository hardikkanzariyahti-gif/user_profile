import { useEffect, useRef, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [file, setFile] = useState(null);
  const [updateUserId, setUpdateUserId] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [updateEmail, setUpdateEmail] = useState('');
  const [updateFile, setUpdateFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'

  const [currentUser, setCurrentUser] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const updatedAtLabel =
    currentUser?.updatedAt && !Number.isNaN(new Date(currentUser.updatedAt).getTime())
      ? new Date(currentUser.updatedAt).toLocaleDateString()
      : 'Not available';

  useEffect(() => {
    if (!userId) return;
    async function fetchUser() {
      try {
        const res = await fetch(`${API_BASE}/users/${userId}`);
        if (!res.ok) throw new Error('User not found');
        const data = await res.json();
        setCurrentUser(data);
        setProfilePicture(data.profilePicture);
      } catch (e) {
        setMessage(e.message);
        setMessageType('error');
        setCurrentUser(null);
      }
    }
    fetchUser();
  }, [userId]);

  const createUser = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setMessage('Please fill in all required fields');
      setMessageType('error');
      return;
    }

    const form = new FormData();
    form.append('name', name);
    form.append('email', email);
    if (file) {
      form.append('profilePicture', file);
    }

    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json();
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
      return;
    }

    const data = await res.json();
    setUserId(data.id);
    setCurrentUser(data);
    setProfilePicture(data.profilePicture);
    setFile(null);
    setMessage(`✓ Profile created successfully! ID: ${data.id}`);
    setMessageType('success');
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
    } catch (e) {
      setMessage('❌ Camera access denied or not available');
      setMessageType('error');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setMessage('📷 Camera stopped.');
      setMessageType('info');
    }
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

      // Stop camera after capture
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }, 'image/jpeg');
  };

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const loadUserForUpdate = async () => {
    if (!updateUserId.trim()) {
      setMessage('Please enter a User ID to load');
      setMessageType('error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/users/${updateUserId}`);
      if (!res.ok) throw new Error('User not found');

      const user = await res.json();
      setUpdateName(user.name || '');
      setUpdateEmail(user.email || '');
      setUpdateFile(null);
      setMessage('✓ User data loaded for editing');
      setMessageType('success');
    } catch (e) {
      setMessage(`❌ ${e.message}`);
      setMessageType('error');
      setUpdateName('');
      setUpdateEmail('');
    }
  };

  const updateUser = async (e) => {
    e.preventDefault();
    if (!updateUserId.trim()) {
      setMessage('Please enter a User ID');
      setMessageType('error');
      return;
    }

    if (!updateName.trim() || !updateEmail.trim()) {
      setMessage('Please fill in all required fields');
      setMessageType('error');
      return;
    }

    const form = new FormData();
    form.append('name', updateName);
    form.append('email', updateEmail);
    if (updateFile) {
      form.append('profilePicture', updateFile);
    }

    try {
      const res = await fetch(`${API_BASE}/users/${updateUserId}`, {
        method: 'PUT',
        body: form,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessage(`❌ Error: ${err.message}`);
        setMessageType('error');
        return;
      }

      const updated = await res.json();
      
      // Update current user display if it's the same user
      if (currentUser && currentUser.id === updated.id) {
        setCurrentUser(updated);
        setProfilePicture(updated.profilePicture);
      }

      setUpdateFile(null);
      setMessage('✓ Profile updated successfully!');
      setMessageType('success');
    } catch (e) {
      setMessage(`❌ Update failed: ${e.message}`);
      setMessageType('error');
    }
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
    } catch (e) {
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

      // Stop camera after capture
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }, 'image/jpeg');
  };

  return (
    <main className="app-container">
      <h1>👤 Profile Manager</h1>
      <p className="subtitle">Create new profiles or update existing ones with camera capture and file upload</p>

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
          {file && <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--success)' }}>✓ {file.name}</p>}
          
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>Or capture from camera:</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={startCamera}
                style={{ 
                  background: '#10B981', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '6px', 
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#059669'}
                onMouseOut={(e) => e.target.style.background = '#10B981'}
              >
                📷 Start Camera
              </button>
              <button 
                type="button" 
                onClick={stopCamera}
                style={{ 
                  background: '#EF4444', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '6px', 
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#DC2626'}
                onMouseOut={(e) => e.target.style.background = '#EF4444'}
              >
                ⏹️ Stop Camera
              </button>
              <button 
                type="button" 
                onClick={captureImage}
                style={{ 
                  background: '#F59E0B', 
                  color: 'white', 
                  border: 'none', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '6px', 
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#D97706'}
                onMouseOut={(e) => e.target.style.background = '#F59E0B'}
              >
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
                    border: '2px solid #E5E7EB'
                  }}
                />
              </div>
            )}
          </div>
        </div>
        <button type="submit">Create Profile</button>
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

      <form onSubmit={updateUser} className="card">
        <h2>✏️ Update Existing Profile</h2>
        
        <div className="form-group">
          <label htmlFor="updateUserId">User ID to Update</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <input
              id="updateUserId"
              value={updateUserId}
              onChange={(e) => setUpdateUserId(e.target.value)}
              placeholder="Enter user ID"
              type="text"
              style={{ flex: 1 }}
              required
            />
            <button 
              type="button" 
              onClick={loadUserForUpdate}
              style={{ 
                background: '#6B7280', 
                color: 'white', 
                border: 'none', 
                padding: '0.875rem 1rem', 
                borderRadius: '8px', 
                fontSize: '0.9rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Load User
            </button>
          </div>
        </div>

        {(updateName || updateEmail) && (
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
              {updateFile && <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--success)' }}>✓ {updateFile.name}</p>}
              
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>Or capture new photo from camera:</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    onClick={startCameraUpdate}
                    style={{ 
                      background: '#10B981', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '6px', 
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#059669'}
                    onMouseOut={(e) => e.target.style.background = '#10B981'}
                  >
                    📷 Start Camera
                  </button>
                  <button 
                    type="button" 
                    onClick={stopCamera}
                    style={{ 
                      background: '#EF4444', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '6px', 
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#DC2626'}
                    onMouseOut={(e) => e.target.style.background = '#EF4444'}
                  >
                    ⏹️ Stop Camera
                  </button>
                  <button 
                    type="button" 
                    onClick={captureImageUpdate}
                    style={{ 
                      background: '#F59E0B', 
                      color: 'white', 
                      border: 'none', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '6px', 
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#D97706'}
                    onMouseOut={(e) => e.target.style.background = '#F59E0B'}
                  >
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
                        border: '2px solid #E5E7EB'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <button type="submit">Update Profile</button>
          </>
        )}
      </form>
    </main>
  );
}

export default App;
