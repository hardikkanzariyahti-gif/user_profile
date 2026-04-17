import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import { login } from '../services/authService';
import { identifyFace } from '../services/faceService';

interface LoginProps {
  onLogin: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const navigate = useNavigate();

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const data = await login({ email, password });
      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => {
        onLogin(data.user);
        navigate('/gallery');
      }, 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFaceLogin = async (capturedFile: File) => {
    setLoading(true);
    setMessage({ type: 'info', text: 'Verifying face with AI...' });

    try {
      const formData = new FormData();
      formData.append('image', capturedFile);

      const data = await identifyFace(formData);
      if (data.users && data.users.length > 0) {
        const matchedUser = data.users[0];
        const normalizedUser = {
          ...matchedUser,
          id: Number(matchedUser.originalId ?? matchedUser.id),
        };

        setMessage({ type: 'success', text: `Welcome back, ${normalizedUser.name}!` });
        setTimeout(() => {
          onLogin(normalizedUser);
          navigate('/gallery');
        }, 1000);
      } else {
        throw new Error(data.message || 'Face not recognized. Try standard login.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setShowCamera(false);
    }
  };

  return (
    <div className="max-w-md mx-auto" style={{ maxWidth: '450px', margin: '4rem auto' }}>
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(99, 102, 241, 0.1)',
            padding: '1rem',
            borderRadius: '50%',
            marginBottom: '1rem',
          }}>
            <LogIn size={32} className="text-primary" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome Back</h2>
          <p className="text-muted">Access your personalized AI gallery</p>
        </div>

        {showCamera ? (
          <div>
            <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>AI Face Verification</h3>
            <CameraCapture
              onCapture={handleFaceLogin}
              onCancel={() => setShowCamera(false)}
            />
          </div>
        ) : (
          <>
            <form onSubmit={handleStandardLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    style={{ paddingLeft: '3rem' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingLeft: '3rem' }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                {loading ? <span className="loading-spinner"></span> : 'Login to Profile'}
              </button>
            </form>


          </>
        )}
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

export default Login;
