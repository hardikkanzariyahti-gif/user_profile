import { useState } from 'react';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lookupUserId, setLookupUserId] = useState('');
  const [updateUserId, setUpdateUserId] = useState('');
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);

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

      console.log("CREATED USER:", data);

      setUser(data);
      setLookupUserId(String(data.id));
      setUpdateUserId(String(data.id));

    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  // =========================
  // GET USER
  // =========================
  const getUser = async () => {
    if (!lookupUserId) {
      alert("Enter user ID");
      return;
    }

    try {
      const res = await fetch(`${API}/users/${lookupUserId}`);

      if (!res.ok) {
        alert("User not found");
        return;
      }

      const data = await res.json();

      console.log("GET USER:", data);

      setUser(data);
      setUpdateUserId(String(data.id));

    } catch (err) {
      console.error(err);
      alert("Error fetching user");
    }
  };

  // =========================
  // UPDATE USER PROFILE PICTURE
  // =========================
  const uploadImage = async () => {
    if (!updateUserId) {
      alert("Enter user ID for update");
      return;
    }

    if (!file) {
      alert("Select profile picture first");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("profilePicture", file);

      console.log("Uploading for ID:", updateUserId);

      const res = await fetch(`${API}/users/${updateUserId}`, {
        method: "PUT",
        body: formData
      });

      let data;

      try {
        data = await res.json(); // ✅ SAFE JSON
      } catch {
        alert("Invalid server response");
        return;
      }

      console.log("UPLOAD RESPONSE:", data);

      if (!res.ok) {
        alert(data.message || data.error || "Upload failed");
        return;
      }

      console.log("UPDATED USER:", data);

      setUser(data);
      alert("Profile picture updated successfully");

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
        value={lookupUserId}
        onChange={(e) => setLookupUserId(e.target.value)}
      />
      <br /><br />

      <button onClick={getUser}>Get User</button>

      <hr />

      {/* UPLOAD IMAGE */}
      <h2>Upload Profile Picture</h2>

      <input
        placeholder="User ID to Update"
        value={updateUserId}
        onChange={(e) => setUpdateUserId(e.target.value)}
      />
      <br /><br />

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
          {user.profilePicture && (
            <div>
              <p><b>Profile Picture:</b></p>
              <img
                src={user.profilePicture}
                alt={`${user.name}'s profile`}
                width="120"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
