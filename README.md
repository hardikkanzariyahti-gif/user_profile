# User Profile Project

## Overview
This project contains a full-stack user profile application with:
- Backend (Express): create / update user, upload profile picture, serve image files
- Frontend (Vite + React): create user form, upload profile picture form, display user data

## Backend structure
- `backend/index.js`
- `backend/db.js`
- `backend/package.json`
- `backend/.gitignore`

### Backend instructions
1. `cd backend`
2. `npm install`
3. `npm run start`
4. Server runs on `http://localhost:4000`

### Backend code

#### `backend/package.json`
```json
{
  "name": "userprofile-backend",
  "version": "1.0.0",
  "description": "User profile API with image upload",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "lowdb": "^6.0.1",
    "multer": "^1.4.5-lts.1",
    "nanoid": "^4.0.0"
  }
}
```

#### `backend/db.js`
```js
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const fs = require('fs');

const dbFile = path.join(__dirname, 'data.json');
if (!fs.existsSync(dbFile)) {
  fs.writeFileSync(dbFile, JSON.stringify({ users: [] }, null, 2));
}

const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function initDb() {
  await db.read();
  db.data = db.data || { users: [] };
  await db.write();
}

async function getAllUsers() {
  await db.read();
  return db.data.users;
}

async function getUserById(id) {
  await db.read();
  return db.data.users.find((u) => u.id === id);
}

async function createUser(user) {
  await db.read();
  db.data.users.push(user);
  await db.write();
  return user;
}

async function updateUser(id, update) {
  await db.read();
  const idx = db.data.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  db.data.users[idx] = { ...db.data.users[idx], ...update };
  await db.write();
  return db.data.users[idx];
}

module.exports = { initDb, getAllUsers, getUserById, createUser, updateUser };
```

#### `backend/index.js`
```js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { initDb, getUserById, createUser, updateUser } = require('./db');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'name and email are required' });

  const newUser = {
    id: nanoid(10),
    name,
    email,
    profilePicture: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const saved = await createUser(newUser);
  res.status(201).json(saved);
});

app.get('/api/users/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

app.put('/api/users/:id', upload.single('profilePicture'), async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const updates = {};
  if (req.body.name) updates.name = req.body.name;
  if (req.body.email) updates.email = req.body.email;

  if (req.file) {
    updates.profilePicture = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  }

  updates.updatedAt = new Date().toISOString();

  const updated = await updateUser(req.params.id, updates);
  res.json(updated);
});

app.get('/api/users', async (req, res) => {
  const { getAllUsers } = require('./db');
  const users = await getAllUsers();
  res.json(users);
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
});
```

## Frontend structure
- `frontend/index.html`
- `frontend/vite.config.js`
- `frontend/package.json`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/styles.css`

### Frontend instructions
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. App runs on `http://localhost:5173`

### Frontend code

#### `frontend/package.json`
```json
{
  "name": "userprofile-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.5"
  }
}
```

#### `frontend/vite.config.js`
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

#### `frontend/index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>UserProfile App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

#### `frontend/src/main.jsx`
```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### `frontend/src/App.jsx`
```js
import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

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
```

#### `frontend/src/styles.css`
```css
:root {
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color-scheme: light;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #f5f7fb;
}

.app-container {
  max-width: 760px;
  margin: 2rem auto;
  padding: 1rem;
}

.card {
  padding: 1rem;
  margin-bottom: 1rem;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 5px 20px rgba(25, 30, 40, 0.07);
}

label {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  display: block;
}

input {
  width: 100%;
  margin-top: 0.25rem;
  margin-bottom: 0.8rem;
  padding: 8px 10px;
  font-size: 1rem;
  border: 1px solid #ccd4e0;
  border-radius: 6px;
}

button {
  background: #2f80ed;
  color: white;
  border: 0;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
}

button:hover {
  background: #246ace;
}

.message {
  font-weight: bold;
  margin-top: 0.5rem;
  color: #1d4f8e;
}

.profile-img {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  object-fit: cover;
  margin-top: 0.7rem;
}
```

## How it works
- Frontend form collects data and hits backend APIs.
- Backend persists user in JSON file and stores uploaded pictures.
- Image URL returned by backend is rendered in frontend.
- Use the built-in `GET` and `PUT` endpoints to update and verify user data.

## Quick flow
1. Create user with POST `/api/users`.
2. Save user `id`.
3. Upload image using PUT `/api/users/:id` with `profilePicture` field.
4. Visit `GET /api/users/:id` to read object and view image URL.

## Notes
- Keep backend running while using frontend.
- Check `/backend/uploads` for saved image files.
- `backend/data.json` contains all users saved in format: `{ users: [...] }`.
# user_profile
