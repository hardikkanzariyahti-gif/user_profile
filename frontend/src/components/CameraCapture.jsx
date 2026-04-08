import React, { useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, X } from 'lucide-react';

const CameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const context = canvasRef.current.getContext('2d');
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;
    
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    
    context.drawImage(videoRef.current, 0, 0, width, height);
    
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirm = () => {
    // Convert base64 to File object
    fetch(capturedImage)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "camera-capture.png", { type: "image/png" });
        onCapture(file, capturedImage);
      });
  };

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="camera-container">
      <div className="camera-wrapper">
        {!capturedImage ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="video-preview"
            />
            {error && <div className="error-message p-4 text-center">{error}</div>}
          </>
        ) : (
          <img src={capturedImage} alt="Captured" className="video-preview" />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="camera-controls">
        {!capturedImage ? (
          <button 
            type="button" 
            onClick={takePhoto} 
            className="capture-btn"
            title="Take Photo"
          />
        ) : (
          <>
            <button 
              type="button" 
              onClick={retake} 
              className="btn btn-outline"
            >
              <RefreshCw size={20} /> Retake
            </button>
            <button 
              type="button" 
              onClick={confirm} 
              className="btn btn-primary"
            >
              <Check size={20} /> Use Photo
            </button>
          </>
        )}
        <button 
          type="button" 
          onClick={onCancel} 
          className="btn btn-danger"
        >
          <X size={20} /> Cancel
        </button>
      </div>
    </div>
  );
};

export default CameraCapture;
