// AI Compatibility Hack: Alias tfjs-node to standard tfjs
try {
  const tf = require('@tensorflow/tfjs');
  require.cache[require.resolve('@tensorflow/tfjs-node')] = {
    id: require.resolve('@tensorflow/tfjs-node'),
    loaded: true,
    exports: tf
  };
} catch (e) {
  console.warn('AI Compatibility Hack: Could not alias tensorflow');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const supabase = require('./supabase');

const faceapi = require('./faceAi');

const app = express();
const PORT = 4000;

// Load AI models on startup
faceapi.loadModels();

app.use(cors());
app.use(express.json());

// Setup static uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Global Gallery Store (JSON File)
const galleryFile = path.join(__dirname, 'gallery.json');
if (!fs.existsSync(galleryFile)) {
  fs.writeFileSync(galleryFile, JSON.stringify([], null, 2));
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('Backend API is running on Port 4000 🚀');
});

// =========================
// GLOBAL GALLERY ROUTES
// =========================
app.get('/api/gallery', async (req, res) => {
  try {
    // 1. Get manually uploaded images (gallery.json)
    const localGallery = JSON.parse(fs.readFileSync(galleryFile));
    
    // 2. Get current profile pictures from Supabase
    const { data: users, error } = await supabase
      .from('users')
      .select('name, "profile picture"');
    
    if (error) throw error;

    const profilePictures = users
      .filter(u => u['profile picture'])
      .map(u => {
        let url = u['profile picture'];
        if (url.includes('localhost:5000')) {
          url = url.replace('localhost:5000', `localhost:${PORT}`);
        }
        return {
          url: url,
          uploadedAt: new Date(0).toISOString(),
          label: `${u.name}'s Profile`,
          isProfile: true
        };
      });

    // 3. Combine and De-duplicate by URL
    const combined = [...localGallery, ...profilePictures];
    const uniqueImages = [];
    const seenUrls = new Set();

    for (const item of combined) {
      if (!seenUrls.has(item.url)) {
        // 4. VALIDATION: Only show if the file actually exists on the server
        const filename = item.url.split('/').pop();
        const filePath = path.join(uploadsDir, filename);
        
        if (fs.existsSync(filePath)) {
          seenUrls.add(item.url);
          uniqueImages.push(item);
        }
      }
    }
    
    // Sort by date (descending)
    uniqueImages.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    res.json(uniqueImages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery', upload.array('gallery', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  const newImages = req.files.map(file => ({
    url: `http://localhost:${PORT}/uploads/${file.filename}`,
    uploadedAt: new Date().toISOString()
  }));

  const existingGallery = JSON.parse(fs.readFileSync(galleryFile));
  const updatedGallery = [...newImages, ...existingGallery];
  
  fs.writeFileSync(galleryFile, JSON.stringify(updatedGallery, null, 2));
  res.json(updatedGallery);
});

// =========================
// FACE RECOGNITION ROUTE
// =========================
app.post('/api/identify', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image provided" });

  try {
    // 1. Get all users with profile pictures
    const { data: users } = await supabase.from('users').select('id, name, "profile picture"');
    
    // 2. Prepare labeled descriptors
    const labeledDescriptors = [];
    for (const user of users) {
      if (!user['profile picture']) continue;
      
      const filename = user['profile picture'].split('/').pop();
      const filePath = path.join(uploadsDir, filename);
      
      if (fs.existsSync(filePath)) {
        const descriptor = await faceapi.getFaceDescriptor(filePath);
        if (descriptor) {
          const labelData = JSON.stringify({ id: user.id, name: user.name });
          labeledDescriptors.push(new (require('@vladmandic/face-api')).LabeledFaceDescriptors(labelData, [descriptor]));
        }
      }
    }

    if (labeledDescriptors.length === 0) {
      return res.json({ message: "No known faces to compare with." });
    }

    // 3. Identify the target image
    const match = await faceapi.identifyFace(req.file.path, labeledDescriptors);

    if (match) {
      const matchData = JSON.parse(match.label);
      res.json({ 
        message: "Match found!", 
        userId: matchData.id,
        userName: matchData.name, 
        confidence: (1 - match.distance).toFixed(2) 
      });
    } else {
      res.json({ message: "Unknown User" });
    }
    
    // Cleanup temporary upload
    fs.unlinkSync(req.file.path);

  } catch (err) {
    console.error('Identification failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// CREATE USER
// =========================
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    return res.status(400).json({ message: 'A user with this email already exists.' });
  }

  const { data, error } = await supabase
    .from('users')
    .insert([{ name, email }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// =========================
// GET ALL USERS
// =========================
app.get('/api/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Fix old localhost:5000 URLs in users list
  const fixedData = data.map(u => {
    if (u['profile picture'] && u['profile picture'].includes('localhost:5000')) {
      u['profile picture'] = u['profile picture'].replace('localhost:5000', `localhost:${PORT}`);
    }
    return u;
  });

  res.json(fixedData);
});

// =========================
// GET USER BY ID
// =========================
app.get('/api/users/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// =========================
// UPDATE USER with Picture
// =========================
app.put('/api/users/:id', upload.single('profilePicture'), async (req, res) => {
  const { name, email } = req.body;
  const updates = {};
  
  if (name) updates.name = name;
  if (email) updates.email = email;
  
  if (req.file) {
    updates['profile picture'] = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ message: "User not found" });

  // NEW: Also save this profile picture to the Global Gallery for history!
  if (req.file) {
    const galleryItem = {
      url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
      uploadedAt: new Date().toISOString(),
      label: `${data[0].name}'s New Profile Picture`,
      isProfile: true
    };
    const existingGallery = JSON.parse(fs.readFileSync(galleryFile));
    fs.writeFileSync(galleryFile, JSON.stringify([galleryItem, ...existingGallery], null, 2));
  }

  res.json(data[0]);
});

// =========================
// DELETE USER
// =========================
app.delete('/api/users/:id', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "User deleted successfully" });
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});