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
}

function toUserResponse(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profilePicture: user.profile_picture,
    ['profile picture']: user.profile_picture,
  };
}

function toGalleryResponse(item: GalleryItem & { recognizedUsers?: any[] }) {
  return {
    id: item.id,
    url: item.url,
    uploadedAt: item.uploadedAt,
    label: item.label,
    isProfile: item.isProfile,
    userId: item.userId,
    recognizedUserIds: item.recognizedUserIds || [],
    recognizedUsers: item.recognizedUsers || [],
  };
}

export { toUserResponse, toGalleryResponse };
