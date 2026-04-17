import React, { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File, dataUrl: string) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  React.useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }).then((mediaStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            const dataUrl = canvasRef.current!.toDataURL('image/jpeg');
            onCapture(file, dataUrl);
          }
        }, 'image/jpeg');
      }
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          maxWidth: '500px',
          borderRadius: '8px',
          marginBottom: '1rem',
          background: '#000',
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} width={640} height={480} />
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={handleCapture} style={{ padding: '0.75rem 1.5rem' }}>
          <Camera size={18} /> Capture
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel} style={{ padding: '0.75rem 1.5rem' }}>
          <X size={18} /> Cancel
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;
