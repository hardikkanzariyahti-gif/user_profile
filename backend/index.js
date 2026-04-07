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

const MAX_NAME_LENGTH = 80;
const MIN_NAME_LENGTH = 2;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

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

const getErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
};

const safeUnlink = async (filepath) => {
  try {
    await fs.promises.unlink(filepath);
  } catch {
    // ignore
  }
};

const cleanupUploadedFile = async (file) => {
  if (!file?.path) return;
  await safeUnlink(file.path);
};

const normalizeName = (raw) =>
  String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeEmail = (raw) => String(raw ?? '').trim().toLowerCase();

const isValidEmail = (email) => {
  if (!email) return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const sanitizeSearchQuery = (raw) =>
  String(raw ?? '')
    .trim()
    .replace(/[%_\\,]/g, '') // prevent wildcard patterns / or() injection
    .slice(0, 100);

const findUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data, error: null };
};

const findUserByName = async (name) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data, error: null };
};

// Setup Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const isImage = typeof file.mimetype === 'string' && file.mimetype.startsWith('image/');
    if (!isImage) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
});

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
  const rawName = req.body?.name;
  const rawEmail = req.body?.email;

  const name = normalizeName(rawName);
  const email = normalizeEmail(rawEmail);

  if (!name || !email) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ message: 'Name and email are required' });
  }

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    await cleanupUploadedFile(req.file);
    return res
      .status(400)
      .json({ message: `Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters` });
  }

  if (!isValidEmail(email)) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }

  // De-dupe / idempotency: if the exact same user was already created, return it instead of inserting again.
  const { data: existingByEmail, error: existingByEmailError } = await findUserByEmail(email);
  if (existingByEmailError) {
    await cleanupUploadedFile(req.file);
    return res.status(500).json({ message: getErrorMessage(existingByEmailError, 'Failed to validate user') });
  }

  if (existingByEmail) {
    await cleanupUploadedFile(req.file);
    const existingName = normalizeName(existingByEmail.name);
    if (existingName.toLowerCase() === name.toLowerCase()) {
      return res.status(200).json({ ...mapUser(existingByEmail), existing: true });
    }
    return res.status(409).json({ message: 'Email already exists. Please use a different email.' });
  }

  const { data: existingByName, error: existingByNameError } = await findUserByName(name);
  if (existingByNameError) {
    await cleanupUploadedFile(req.file);
    return res.status(500).json({ message: getErrorMessage(existingByNameError, 'Failed to validate user') });
  }

  if (existingByName) {
    await cleanupUploadedFile(req.file);
    return res.status(409).json({ message: 'Name already exists. Please use a different name.' });
  }

  const userData = { name, email };
  if (req.file) userData['profile picture'] = `http://localhost:${PORT}/uploads/${req.file.filename}`;

  const { data, error } = await supabase.from('users').insert([userData]).select();

  if (error) {
    await cleanupUploadedFile(req.file);
    return res.status(500).json({ message: getErrorMessage(error, 'Failed to create user') });
  }

  res.status(201).json(mapUser(data[0]));
});

// =========================
// LOGIN (by email)
// =========================
app.post('/api/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ message: 'Email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });

  const { data, error } = await findUserByEmail(email);
  if (error) return res.status(500).json({ message: getErrorMessage(error, 'Login failed') });
  if (!data) return res.status(404).json({ message: 'No user found for that email' });

  res.json(mapUser(data));
});

// =========================
// GET ALL USERS
// =========================
app.get('/api/users', async (req, res) => {
  const q = sanitizeSearchQuery(req.query?.q);
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 50;

  let query = supabase.from('users').select('*').limit(limit);
  if (q) {
    const pattern = `%${q}%`;
    query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ message: getErrorMessage(error, 'Failed to fetch users') });
  }

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

  if (error) {
    return res.status(404).json({ message: getErrorMessage(error, 'User not found') });
  }

  res.json(mapUser(data));
});

// =========================
// UPDATE USER & UPLOAD PROFILE PICTURE
// =========================
app.put('/api/users/:id', upload.single('profilePicture'), async (req, res) => {
  const { name: rawName, email: rawEmail } = req.body;
  const updateData = {};
  
  if (rawName != null) {
    const name = normalizeName(rawName);
    if (!name) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      await cleanupUploadedFile(req.file);
      return res
        .status(400)
        .json({ message: `Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters` });
    }
    updateData.name = name;
  }

  if (rawEmail != null) {
    const email = normalizeEmail(rawEmail);
    if (!email) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({ message: 'Email cannot be empty' });
    }
    if (!isValidEmail(email)) {
      await cleanupUploadedFile(req.file);
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    updateData.email = email;
  }
  
  if (req.file) {
    updateData['profile picture'] = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  }

  if (Object.keys(updateData).length === 0) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ message: 'Provide a name, email, or profile picture to update' });
  }

  // Prevent duplicates when updating (exclude current id)
  if (updateData.email) {
    const { data: byEmail, error: byEmailError } = await findUserByEmail(updateData.email);
    if (byEmailError) {
      await cleanupUploadedFile(req.file);
      return res.status(500).json({ message: getErrorMessage(byEmailError, 'Failed to validate user') });
    }
    if (byEmail && String(byEmail.id) !== String(req.params.id)) {
      await cleanupUploadedFile(req.file);
      return res.status(409).json({ message: 'Email already exists. Please use a different email.' });
    }
  }

  if (updateData.name) {
    const { data: byName, error: byNameError } = await findUserByName(updateData.name);
    if (byNameError) {
      await cleanupUploadedFile(req.file);
      return res.status(500).json({ message: getErrorMessage(byNameError, 'Failed to validate user') });
    }
    if (byName && String(byName.id) !== String(req.params.id)) {
      await cleanupUploadedFile(req.file);
      return res.status(409).json({ message: 'Name already exists. Please use a different name.' });
    }
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', req.params.id)
    .select();

  if (error) {
    await cleanupUploadedFile(req.file);
    return res.status(500).json({ message: getErrorMessage(error, 'Failed to update user') });
  }

  if (!data || data.length === 0) {
    await cleanupUploadedFile(req.file);
    return res.status(404).json({ message: "User not found" });
  }

  res.json(mapUser(data[0]));
});

// Multer / upload errors
app.use((err, req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Profile picture is too large (max 5MB)' });
    }
    return res.status(400).json({ message: getErrorMessage(err, 'Upload failed') });
  }
  if (err?.message === 'Only image uploads are allowed') {
    return res.status(400).json({ message: err.message });
  }
  return res.status(500).json({ message: getErrorMessage(err, 'Server error') });
});

// START SERVER (ALWAYS LAST)
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
