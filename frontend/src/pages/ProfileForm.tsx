import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Camera, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import { createUser, fetchUserById, updateUser } from '../services/userService';
import { identifyFace } from '../services/faceService';

interface ProfileFormProps {
  mode?: 'create' | 'update';
}

const ProfileForm: React.FC<ProfileFormProps> = ({ mode = 'create' }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    if (mode === 'update' && id) {
      setLoading(true);
      fetchUserById(Number(id))
        .then((data) => {
          setFormData({ name: data.name, email: data.email, password: '' });
          setPreview(data.profilePicture || data['profile picture'] || null);
        })
        .catch((err) => {
          setMessage({ type: 'error', text: err.message });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id, mode]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (mode === 'create' && !formData.password) {
      newErrors.password = 'Password is required to create a profile';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.currentTarget.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setShowCamera(false);
    }
  };

  const handleCameraCapture = (capturedFile: File, dataUrl: string) => {
    setFile(capturedFile);
    setPreview(dataUrl);
    setShowCamera(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage(null);

    try {
      let resultId = id ? Number(id) : null;

      if (file) {
        const verifyForm = new FormData();
        verifyForm.append('image', file);
        const verifyData = await identifyFace(verifyForm);

        if (verifyData.users?.length) {
          const detectedUser = verifyData.users[0];
          if (mode === 'create' || String(detectedUser.originalId) !== String(id)) {
            throw new Error(`Duplicate detected: This face is already registered to ${detectedUser.name}.`);
          }
        }
      }

      if (mode === 'create') {
        const created = await createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        resultId = created.id;
      }

      const updateForm = new FormData();
      if (file) updateForm.append('profilePicture', file);
      if (formData.name) updateForm.append('name', formData.name);
      if (formData.email) updateForm.append('email', formData.email);
      if (formData.password) updateForm.append('password', formData.password);

      await updateUser(resultId!, updateForm);

      setMessage({ type: 'success', text: `Profile ${mode === 'create' ? 'created' : 'updated'} successfully!` });
      setTimeout(() => navigate('/'), 1200);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading && mode === 'update' && !formData.name) {
    return <div className="text-center p-10">Loading user data...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button onClick={() => navigate('/')} className="btn btn-outline mb-6" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={18} /> Back to List
      </button>

      <div className="card">
        <h2 className="card-title">
          {mode === 'create' ? 'Create New Profile' : 'Update Profile'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="John Doe"
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <p className="error-message">{errors.name}</p>}
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="john@example.com"
              className={errors.email ? 'error' : ''}
              disabled={mode === 'update'}
            />
            {errors.email && <p className="error-message">{errors.email}</p>}
          </div>

          <div className="form-group">
            <label>Security Password</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              className={errors.password ? 'error' : ''}
            />
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {mode === 'create'
                ? 'Create a password to secure your profile.'
                : 'Leave blank to keep your current password.'}
            </p>
            {errors.password && <p className="error-message">{errors.password}</p>}
          </div>

          <div className="form-group">
            <label>Profile Picture</label>

            <div className="flex flex-col items-center gap-4 mb-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {preview && !showCamera && (
                <div className="user-avatar-container" style={{ width: '150px', height: '150px' }}>
                  <img src={preview} alt="Preview" className="user-avatar" />
                </div>
              )}

              {showCamera ? (
                <div style={{ width: '100%' }}>
                  <CameraCapture
                    onCapture={handleCameraCapture}
                    onCancel={() => setShowCamera(false)}
                  />
                </div>
              ) : (
                <div className="flex gap-2" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="btn btn-outline"
                  >
                    <Camera size={18} /> Use Camera
                  </button>
                  <label className="btn btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                    <Upload size={18} /> Upload File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading || showCamera}
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              <><Save size={20} /> {mode === 'create' ? 'Create Profile' : 'Save Changes'}</>
            )}
          </button>
        </form>
      </div>

      {message && (
        <div className="message-toast" style={{ backgroundColor: message.type === 'error' ? 'var(--error)' : 'var(--success)' }}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ProfileForm;
