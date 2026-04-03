import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const [currentUser, setCurrentUser] = useState(null);

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
        setCurrentUser(null);
      }
    }
    fetchUser();
  }, [userId]);

  const createUser = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage(`Error: ${err.message}`);
      return;
    }
    const data = await res.json();
    setUserId(data.id);
    setCurrentUser(data);
    setMessage('Profile created successfully.');
  };

  const uploadPicture = async (e) => {
    e.preventDefault();
    if (!userId || !file) {
      setMessage('Select created user and an image file first');
      return;
    }

    const form = new FormData();
    form.append('profilePicture', file);
    if (name) form.append('name', name);
    if (email) form.append('email', email);

    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PUT',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json();
      setMessage(`Error: ${err.message}`);
      return;
    }

    const updated = await res.json();
    setCurrentUser(updated);
    setProfilePicture(updated.profilePicture);
    setMessage('Profile picture updated successfully.');
  };

  return (
    <main className="app-container">
      <h1>User Profile Creation</h1>

      <form onSubmit={createUser} className="card">
        <h2>Create user</h2>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <button type="submit">Create</button>
      </form>

      <form onSubmit={uploadPicture} className="card">
        <h2>Upload / Update Profile Picture</h2>
        <label>User ID</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" required />

        <label>Image</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        <button type="submit">Upload Picture</button>
      </form>

      {message && <p className="message">{message}</p>}

      {currentUser && (
        <section className="card">
          <h2>Current user data</h2>
          <p><strong>ID:</strong> {currentUser.id}</p>
          <p><strong>Name:</strong> {currentUser.name}</p>
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Updated at:</strong> {currentUser.updatedAt}</p>
          {profilePicture ? (
            <img src={profilePicture} alt="profile" className="profile-img" />
          ) : (
            <p>No picture yet.</p>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
