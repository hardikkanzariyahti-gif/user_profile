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
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgb(59, 89, 152) 0%, rgb(106, 127, 188) 50%, rgb(155, 150, 212) 100%)' }}>
      <div style={{ background: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, rgb(59, 89, 152) 0%, rgb(106, 127, 188) 50%, rgb(155, 150, 212) 100%)', 
          borderRadius: '20px 20px 0 0', 
          padding: '2rem', 
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              width: '48px', 
              height: '48px', 
              borderRadius: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <LogIn size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Welcome Back</h1>
              <p style={{ fontSize: '0.95rem', opacity: 0.9, margin: '0.5rem 0 0 0' }}>Access your personalized AI gallery</p>
            </div>
          </div>
          <button 
            onClick={() => setShowCamera(true)} 
            style={{ 
              marginTop: '1.5rem', 
              width: '100%', 
              padding: '0.75rem 1rem', 
              background: 'rgba(255,255,255,0.15)', 
              border: '1px solid rgba(255,255,255,0.2)', 
              borderRadius: '12px', 
              color: 'white', 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <Camera size={20} />
            <span>Use Face ID</span>
          </button>
        </div>
        
        <div style={{ padding: '2rem' }}>
          {showCamera ? (
            <div>
              <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#1e293b' }}>AI Face Verification</h3>
              <CameraCapture
                onCapture={handleFaceLogin}
                onCancel={() => setShowCamera(false)}
              />
            </div>
          ) : (
            <form onSubmit={handleStandardLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', opacity: 0.8 }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
                    required
                  />
                </div>
                {message?.type === 'error' && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{message.text}</p>}
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', opacity: 0.8 }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s' }}
                    required
                  />
                </div>
                {message?.type === 'success' && <p style={{ color: '#10b981', fontSize: '0.875rem', marginTop: '0.5rem' }}>{message.text}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  background: 'linear-gradient(135deg, rgb(59, 89, 152) 0%, rgb(106, 127, 188) 50%, rgb(155, 150, 212) 100%)', 
                  border: 'none', 
                  borderRadius: '12px', 
                  color: 'white', 
                  fontSize: '0.95rem', 
                  fontWeight: 600, 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 size={20} style={{ marginRight: '0.5rem' }} />
                    <span>Login to Profile</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
