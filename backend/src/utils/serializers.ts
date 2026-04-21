interface User {
  id: number;
  name: string;
  email: string;
  profile_picture?: string | null;
}

interface GalleryItem {
  id: number;
  url: string;
  uploadedAt: Date;
  label?: string | null;
  isProfile: boolean;
  userId?: number | null;
  recognizedUserIds: number[];
  hashtags: string[];
  faceDescriptors?: any | null;
}

import { APP_BASE_URL } from '../config/constants';

function fixUrlPort(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  // If the stored URL is localhost:4000 but we are now on another port, fix it.
  return url.replace('http://localhost:4000', APP_BASE_URL);
}

function toUserResponse(user: User) {
  const profilePicture = fixUrlPort(user.profile_picture);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profilePicture: profilePicture,
    ['profile picture']: profilePicture,
  };
}

function toGalleryResponse(item: GalleryItem & { recognizedUsers?: any[] }) {
  return {
    id: item.id,
    url: fixUrlPort(item.url),
    uploadedAt: item.uploadedAt,
    label: item.label,
    isProfile: item.isProfile,
    userId: item.userId,
    recognizedUserIds: item.recognizedUserIds || [],
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    faces: Array.isArray(item.faceDescriptors) 
      ? item.faceDescriptors.map((f: any, i: number) => ({
          index: i,
          box: f.box,
          manuallyTaggedUserId: f.manuallyTaggedUserId
        }))
      : [],
    // Enrich recognizedUsers with profilePicture so UI avatars work in tags
    recognizedUsers: (item.recognizedUsers || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      profilePicture: fixUrlPort(u.profile_picture || u.profilePicture) || null,
    })),
  };
}

export { toUserResponse, toGalleryResponse };
