import { Queue } from 'bullmq';
import { getRedis } from './redis';

export function getGalleryScanQueue(): Queue | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Queue('gallery.scan', { connection: redis });
}

export function getGalleryPreprocessQueue(): Queue | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Queue('gallery.preprocess', { connection: redis });
}

export function getGalleryRefreshQueue(): Queue | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Queue('gallery.refresh', { connection: redis });
}

export type GalleryScanJob =
  | { type: 'upload'; itemIds: number[] }
  | { type: 'refresh'; forceRescan: boolean };

export type GalleryPreprocessJob =
  | { type: 'upload'; itemIds: number[] }
  | { type: 'refresh'; forceRescan: boolean };

