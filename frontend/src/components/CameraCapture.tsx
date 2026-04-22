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

  const stopStream = (mediaStream?: MediaStream | null) => {
    (mediaStream || stream)?.getTracks().forEach((track) => track.stop());
  };

  React.useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }).then((mediaStream) => {
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
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            const dataUrl = canvasRef.current!.toDataURL('image/jpeg');
            stopStream();
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
