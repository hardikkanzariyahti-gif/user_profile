import React from 'react';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
  light?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ text, size = 'md', inline = false, light = false }) => {
  const dotSize = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const fontSize = size === 'sm' ? '0.65rem' : size === 'lg' ? '0.9rem' : '0.78rem';
  const textColor = light ? 'rgba(255,255,255,0.85)' : '#64748b';

  const dots = (
    <div className="loading-dots" style={{ display: 'flex', alignItems: 'center', gap: size === 'sm' ? '4px' : '6px' }}>
      <span className="loading-dot" style={{ width: dotSize, height: dotSize }} />
      <span className="loading-dot" style={{ width: dotSize, height: dotSize }} />
      <span className="loading-dot" style={{ width: dotSize, height: dotSize }} />
    </div>
  );

  if (inline) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        {dots}
        {text && <span style={{ fontSize, fontWeight: 600, color: textColor }}>{text}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
      {dots}
      {text && <p style={{ fontSize, fontWeight: 600, color: textColor, margin: 0 }}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
