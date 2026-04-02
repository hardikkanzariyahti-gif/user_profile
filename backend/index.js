const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

// =========================
// CREATE USER
// =========================
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

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
    .select('*');

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
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
// UPDATE USER
// =========================
app.put('/api/users/:id', async (req, res) => {
  const { name, email } = req.body;

  const { data, error } = await supabase
    .from('users')
    .update({ name, email })
    .eq('id', req.params.id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(data[0]);
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});