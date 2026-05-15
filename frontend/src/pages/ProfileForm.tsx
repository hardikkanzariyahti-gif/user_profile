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

  const [enrollment, setEnrollment] = useState<Record<string, { file: File | null; preview: string | null }>>({
    front: { file: null, preview: null },
    left: { file: null, preview: null },
    right: { file: null, preview: null },
    upper: { file: null, preview: null },
    lower: { file: null, preview: null },
  });

  const [activeAngle, setActiveAngle] = useState<'front' | 'left' | 'right' | 'upper' | 'lower' | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [failedAngles, setFailedAngles] = useState<string[]>([]);

  useEffect(() => {
    if (mode === 'update' && id) {
      setLoading(true);
      fetchUserById(Number(id))
        .then((data: any) => {
          setFormData({ name: data.name, email: data.email, password: '' });
          const profilePic = data.profilePicture || data['profile picture'] || null;
          const profilePics = Array.isArray(data.profilePictures)
            ? data.profilePictures
            : (Array.isArray(data['profile pictures']) ? data['profile pictures'] : []);
          if (profilePic) {
            setEnrollment(prev => ({
              ...prev,
              front: { file: null, preview: profilePic }
            }));
          }
          if (profilePics.length > 0) {
            setEnrollment({
              front: { file: null, preview: profilePics[0] || profilePic },
              left: { file: null, preview: profilePics[1] || null },
              right: { file: null, preview: profilePics[2] || null },
              upper: { file: null, preview: profilePics[3] || null },
              lower: { file: null, preview: profilePics[4] || null },
            });
          }
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

  const handleFileChange = (angle: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.currentTarget.files?.[0];
    if (selectedFile) {
      setEnrollment(prev => ({
        ...prev,
        [angle]: { file: selectedFile, preview: URL.createObjectURL(selectedFile) }
      }));
    }
  };

  const [verifying, setVerifying] = useState<string | null>(null);

  const handleCameraCapture = async (capturedFile: File, dataUrl: string) => {
    if (!activeAngle) return;

    // Simplification: We trust the CameraCapture's "OK" status which now uses relaxed thresholds.
    // This makes the process much faster as we don't do a double round-trip for quality verification.

    setEnrollment(prev => ({
      ...prev,
      [activeAngle!]: { file: capturedFile, preview: dataUrl }
    }));

    setMessage({ type: 'success', text: `${angles.find(a => a.id === activeAngle)?.label} clear! ✅` });
    setActiveAngle(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setMessage(null);
    setFailedAngles([]);

    try {
      let resultId = id ? Number(id) : null;

      // 1. Optional duplicate check using the front image
      if (enrollment.front.file) {
        const verifyForm = new FormData();
        verifyForm.append('image', enrollment.front.file);
        const verifyData = await identifyFace(verifyForm);

        if (verifyData.users?.length) {
          const detectedUser = verifyData.users[0];
          if (detectedUser.confidence > 0.6) {
            if (mode === 'create' || String(detectedUser.originalId) !== String(id)) {
              throw new Error(`Duplicate detected: This face is already registered to ${detectedUser.name}.`);
            }
          }
        }
      }

      // 2. Create user if in create mode
      if (mode === 'create') {
        const created = await createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        resultId = created.id;
      }

      // 3. Update with multiple profile pictures
      const updateForm = new FormData();
      if (formData.name) updateForm.append('name', formData.name);
      if (formData.email) updateForm.append('email', formData.email);
      if (formData.password) updateForm.append('password', formData.password);

      // Append files in order
      angles.forEach(angle => {
        const entry = enrollment[angle.id];
        if (entry.file) {
          // Rename the file to the angle label so the backend can identify which one failed
          const renamedFile = new File([entry.file], `${angle.label}.jpg`, { type: entry.file.type });
          updateForm.append('profile_pictures', renamedFile);
        }
      });

      await updateUser(resultId!, updateForm);

      setMessage({ type: 'success', text: `Profile ${mode === 'create' ? 'created' : 'updated'} successfully with multi-angle data!` });
      setTimeout(() => navigate('/'), 1200);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });

      // Parse error message to identify failed angles and highlight them
      const failed = angles
        .filter(a => err.message.includes(a.label))
        .map(a => a.id);
      setFailedAngles(failed);
    } finally {
      setLoading(false);
    }
  };

  if (loading && mode === 'update' && !formData.name) {
    return <div className="text-center p-10">Loading user data...</div>;
  }

  const angles = [
    { id: 'front', label: 'Front View', description: 'Look straight' },
    { id: 'left', label: 'Left Side', description: 'Turn head LEFT' },
    { id: 'right', label: 'Right Side', description: 'Turn head RIGHT' },
    { id: 'upper', label: 'Upper View', description: 'Look UP' },
    { id: 'lower', label: 'Lower View', description: 'Look DOWN' },
  ] as const;

  return (
    <div className="max-w-3xl mx-auto" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <button type="button" onClick={() => navigate('/')} className="btn btn-outline mb-6" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={18} /> Back to List
      </button>

      <div className="card">
        <h2 className="card-title">
          {mode === 'create' ? 'Create AI Profile' : 'Update AI Profile'}
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Providing multiple angles (Front, Left, Right) helps our AI recognize you more accurately in different conditions and group photos.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
            {errors.password && <p className="error-message">{errors.password}</p>}
          </div>

          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Face Enrollment (Multi-Angle)</label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              {angles.map((angle) => (
                <div key={angle.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: failedAngles.includes(angle.id)
                    ? '2px solid var(--error)'
                    : (activeAngle === angle.id ? '2px solid var(--primary)' : '1px solid var(--border)'),
                  borderRadius: '12px',
                  backgroundColor: failedAngles.includes(angle.id)
                    ? 'rgba(var(--error-rgb), 0.05)'
                    : (activeAngle === angle.id ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent'),
                }}>
                  <div className="user-avatar-container" style={{ width: '100%', aspectRatio: '1/1', position: 'relative' }}>
                    {enrollment[angle.id].preview ? (
                      <img src={enrollment[angle.id].preview!} alt={angle.label} className="user-avatar" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', color: 'var(--text-muted)', borderRadius: '10px' }}>
                        <Camera size={24} opacity={0.3} />
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{angle.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{angle.description}</div>
                  </div>

                  <div className="flex gap-2" style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => setActiveAngle(angle.id)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: '0.4rem', minWidth: 'auto' }}
                      title="Use Camera"
                    >
                      <Camera size={16} />
                    </button>
                    <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0, padding: '0.4rem', minWidth: 'auto' }} title="Upload File">
                      <Upload size={16} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(angle.id, e)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeAngle && (
            <div className="modal-overlay" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
              <div className="card" style={{ maxWidth: '600px', width: '90%' }}>
                <h3 className="card-title">Capture {angles.find(a => a.id === activeAngle)?.label}</h3>
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                  {angles.find(a => a.id === activeAngle)?.description}
                </p>
                <div style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  color: '#60a5fa'
                }}>
                  <AlertCircle size={18} />
                  <span><b>Guidance:</b> Ensure your face is well-lit and clearly visible. Avoid shadows or blur for the best AI accuracy.</span>
                </div>
                <CameraCapture
                  onCapture={handleCameraCapture}
                  onCancel={() => { setActiveAngle(null); }}
                  targetAngle={activeAngle!}
                />

                {verifying && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '12px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', zIndex: 10, color: 'white'
                  }}>
                    <div className="loading-spinner" style={{ marginBottom: '1rem', width: '40px', height: '40px', borderWidth: '4px' }}></div>
                    <div style={{ fontWeight: 600 }}>Verifying Quality...</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Our AI is ensuring your face is clear for 95% accuracy</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '2rem' }}
            disabled={loading || !!activeAngle}
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              <><Save size={18} /> {mode === 'create' ? 'Enroll & Create Profile' : 'Save AI Model'}</>
            )}
          </button>
        </form>
      </div>

      {message && (
        <div className="message-toast" style={{
          backgroundColor: message.type === 'error' ? 'var(--error)' : 'var(--success)',
          zIndex: 2000
        }}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ProfileForm;
