import { useState } from 'react';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null); // ✅ for image

  const API = "http://localhost:4000/api";

  // =========================
  // CREATE USER
  // =========================
  const createUser = async () => {
    try {
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Error creating user");
        return;
      }

      setUser(data);
      setUserId(data.id);

    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  // =========================
  // GET USER
  // =========================
  const getUser = async () => {
    try {
      const res = await fetch(`${API}/users/${userId}`);
      const data = await res.json();

      if (!res.ok) {
        alert("User not found");
        return;
      }

      setUser(data);

    } catch (err) {
      console.error(err);
      alert("Error fetching user");
    }
  };

  // =========================
  // UPLOAD IMAGE (SAFE VERSION)
  // =========================
  const uploadImage = async () => {
    if (!file || !userId) {
      alert("Create user and select file first");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${API}/users/${userId}`, {
        method: "PUT",
        body: formData
      });

      const text = await res.text(); // ✅ prevents JSON crash
      console.log("UPLOAD RESPONSE:", text);

      alert("Upload API not ready yet (next step)");

    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>User App</h1>

      {/* CREATE USER */}
      <h2>Create User</h2>

      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br /><br />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />

      <button onClick={createUser}>Create User</button>

      <hr />

      {/* GET USER */}
      <h2>Get User</h2>

      <input
        placeholder="User ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <br /><br />

      <button onClick={getUser}>Get User</button>

      <hr />

      {/* UPLOAD IMAGE */}
      <h2>Upload Profile Picture</h2>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <br /><br />

      <button onClick={uploadImage}>Upload Image</button>

      <hr />

      {/* SHOW USER */}
      {user && (
        <div>
          <h3>User Data</h3>
          <p><b>ID:</b> {user.id}</p>
          <p><b>Name:</b> {user.name}</p>
          <p><b>Email:</b> {user.email}</p>
        </div>
      )}
    </div>
  );
}

export default App;