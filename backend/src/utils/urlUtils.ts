import { APP_BASE_URL } from '../config/constants';

/**
 * Builds a public URL for an uploaded file.
 */
export function buildUploadUrl(filename: string): string {
  return `${APP_BASE_URL}/uploads/${filename}`;
}
