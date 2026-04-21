import React, { useMemo, useState } from 'react';

type AnyBox = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  _x?: number;
  _y?: number;
  _width?: number;
  _height?: number;
};

function normalizeBox(box: AnyBox | null | undefined): { x: number; y: number; width: number; height: number } | null {
  if (!box) return null;
  const x = Number((box as any)._x ?? (box as any).x);
  const y = Number((box as any)._y ?? (box as any).y);
  const width = Number((box as any)._width ?? (box as any).width);
  const height = Number((box as any)._height ?? (box as any).height);
  if ([x, y, width, height].some(v => Number.isNaN(v))) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export interface FaceCropProps {
  src: string;
  box?: AnyBox | null;
  size?: number;
  borderRadius?: number;
  paddingFactor?: number; // 1.0 = tight, 1.3 = little context around face
  style?: React.CSSProperties;
  className?: string;
  alt?: string;
}

export default function FaceCrop({
  src,
  box,
  size = 96,
  borderRadius = 16,
  paddingFactor = 1.35,
  style,
  className,
  alt = 'Face crop',
}: FaceCropProps) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const crop = useMemo(() => normalizeBox(box || null), [box]);
  const containerW = size;
  const containerH = size;

  const imgStyle = useMemo(() => {
    if (!natural) return null;
    if (!crop) {
      return {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
      };
    }

    const pad = Math.max(1, paddingFactor);
    const targetBoxW = crop.width * pad;
    const targetBoxH = crop.height * pad;

    const scale = Math.min(containerW / targetBoxW, containerH / targetBoxH);
    const displayW = natural.w * scale;
    const displayH = natural.h * scale;

    const padX = (targetBoxW - crop.width) / 2;
    const padY = (targetBoxH - crop.height) / 2;

    const topLeftX = (crop.x - padX) * scale;
    const topLeftY = (crop.y - padY) * scale;

    return {
      width: `${displayW}px`,
      height: `${displayH}px`,
      position: 'absolute' as const,
      left: 0,
      top: 0,
      transform: `translate(${-topLeftX}px, ${-topLeftY}px)`,
      transformOrigin: 'top left',
      willChange: 'transform',
    };
  }, [containerH, containerW, crop, natural, paddingFactor]);

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        position: 'relative',
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{
          display: natural ? 'block' : 'none',
          ...(imgStyle || {}),
        }}
      />
      {!natural && (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" style={{ width: '18px', height: '18px', borderTopColor: 'var(--primary)' }} />
        </div>
      )}
    </div>
  );
}

