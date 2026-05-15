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

  const stopStream = (mediaStream?: MediaStream | null) => {
    (mediaStream || stream)?.getTracks().forEach((track) => track.stop());
  };

  React.useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } } }).then((mediaStream) => {
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
        const width = videoRef.current.videoWidth || 1280;
        const height = videoRef.current.videoHeight || 960;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        context.drawImage(videoRef.current, 0, 0, width, height);
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${targetAngle}.jpg`, { type: 'image/jpeg' });
            const dataUrl = canvasRef.current!.toDataURL('image/jpeg', 0.95);
            stopStream();
            onCapture(file, dataUrl);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

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
            border: '2px solid rgba(255,255,255,0.15)',
            transition: 'border-color 0.3s ease'
          }}
        />
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCapture}
          style={{
            padding: '0.75rem 1.5rem',
            cursor: 'pointer'
          }}
          title="Capture now"
        >
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
