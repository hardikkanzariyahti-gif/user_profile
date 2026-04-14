import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Edit2, Mail, Calendar, User, Trash2, CheckCircle2 } from 'lucide-react';
import { deleteUser, fetchUsers } from '../services/userService';

const UserList = ({ loggedInUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) return;

    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) return <div className="text-center p-10">Loading profiles...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          <User className="text-primary" /> User Profiles
        </h2>
        <button
          onClick={() => navigate('/create')}
          className="btn btn-primary"
        >
          <UserPlus size={20} /> New Profile
        </button>
      </div>

      {users.length === 0 ? (
        <div className="card text-center p-10">
          <p className="text-muted">No profiles found. Create your first profile!</p>
        </div>
      ) : (
        <div className="user-grid">
          {users.map((user) => (
            <div key={user.id} className="card user-card" style={{ position: 'relative' }}>
              <button
                onClick={() => handleDelete(user.id)}
                className="btn btn-danger"
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '5px',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                }}
                title="Delete Profile"
              >
                <Trash2 size={16} />
              </button>
              <div className="user-avatar-container">
                <img
                  src={user.profilePicture || user['profile picture'] || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                  alt={user.name}
                  className="user-avatar"
                />
              </div>
              <h3 className="user-name">{user.name}</h3>
              <p className="user-email">
                <Mail size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {user.email}
              </p>
              <div className="flex gap-2 w-full" style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1rem' }}>
                <button
                  onClick={() => navigate(`/update/${user.id}`)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  <Edit2 size={16} /> Edit Profile
                </button>
                {loggedInUser?.id === user.id && (
                  <div className="btn btn-primary" style={{ flex: 1, cursor: 'default' }}>
                    <CheckCircle2 size={16} /> Verified
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Updated profile
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserList;
