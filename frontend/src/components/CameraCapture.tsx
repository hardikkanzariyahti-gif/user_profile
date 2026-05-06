import React, { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File, dataUrl: string) => void;
  onCancel: () => void;
  targetAngle?: 'front' | 'left' | 'right' | 'upper' | 'lower';
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel, targetAngle = 'front' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [suggestion, setSuggestion] = useState<string>("Initializing AI...");
  const [status, setStatus] = useState<string>("pending");
  const [poseData, setPoseData] = useState<any>(null);

  const stopStream = (mediaStream?: MediaStream | null) => {
    (mediaStream || stream)?.getTracks().forEach((track) => track.stop());
  };

  React.useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } }).then((mediaStream) => {
      activeStream = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    });

    return () => {
      stopStream(activeStream);
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        const width = videoRef.current.videoWidth || 640;
        const height = videoRef.current.videoHeight || 480;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        context.drawImage(videoRef.current, 0, 0, width, height);
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${targetAngle}.jpg`, { type: 'image/jpeg' });
            const dataUrl = canvasRef.current!.toDataURL('image/jpeg');
            stopStream();
            onCapture(file, dataUrl);
          }
        }, 'image/jpeg');
      }
    }
  };

  // Live Suggestion Loop
  React.useEffect(() => {
    if (!stream) return;

    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240); // Small frame for speed
          const blob = await new Promise<Blob | null>(res => canvasRef.current?.toBlob(res, 'image/jpeg', 0.6));
          if (blob) {
            const fd = new FormData();
            fd.append('image', blob);
            try {
              const res = await fetch('/api/users/check-frame', { method: 'POST', body: fd });
              if (!res.ok) {
                console.warn("Live feedback status error:", res.status);
                return;
              }
              const text = await res.text();
              if (!text) return;
              
              const data = JSON.parse(text);
              setSuggestion(data.message);
              setStatus(data.status);
              setPoseData(data.pose);
            } catch (e) {
              // Ignore errors in the live loop to keep the UI stable
              // We don't want a single failed fetch to break the camera
            }
          }
        }
      }
    }, 800); 

    return () => clearInterval(interval);
  }, [stream, targetAngle]);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            borderRadius: '12px',
            background: '#000',
            border: status === 'ok' ? '3px solid #10b981' : '3px solid #ef4444',
            transition: 'border-color 0.3s ease'
          }}
        />
        
        <div style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '0.75rem'
        }}>
          Target: {targetAngle}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '15px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: status === 'ok' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {status === 'ok' ? '✓' : '!'} {suggestion}
        </div>
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} width={320} height={240} />
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={handleCapture} style={{ padding: '0.75rem 1.5rem' }}>
          <Camera size={18} /> Capture
        </button>
        <button type="button" className="btn btn-outline" onClick={() => { stopStream(); onCancel(); }} style={{ padding: '0.75rem 1.5rem' }}>
          <X size={18} /> Cancel
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;
