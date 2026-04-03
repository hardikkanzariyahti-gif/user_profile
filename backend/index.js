const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Setup uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Map db column 'profile picture' to 'profilePicture' for frontend consistency
const mapUser = (user) => {
  if (!user) return user;
  const mapped = { ...user, profilePicture: user['profile picture'] };
  delete mapped['profile picture'];
  return mapped;
};

// Setup Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage: storage });

// Serve static images 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

// =========================
// CREATE USER
// =========================
app.post('/api/users', upload.single('profilePicture'), async (req, res) => {
  const { name, email } = req.body;

  const userData = { name, email };
  if (req.file) {
    userData['profile picture'] = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  }

  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select();

  if (error) return res.status(500).json({ error });

  res.json(mapUser(data[0]));
});

// =========================
// GET ALL USERS
// =========================
app.get('/api/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) return res.status(500).json({ error });

  res.json(data.map(mapUser));
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

  if (error) return res.status(404).json({ error });

  res.json(mapUser(data));
});

// =========================
// UPDATE USER & UPLOAD PROFILE PICTURE
// =========================
app.put('/api/users/:id', upload.single('profilePicture'), async (req, res) => {
  const { name, email } = req.body;
  const updateData = {};
  
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  
  if (req.file) {
    updateData['profile picture'] = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', req.params.id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(mapUser(data[0]));
});

// START SERVER (ALWAYS LAST)
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});