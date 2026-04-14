function toUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profilePicture: user.profile_picture,
    ['profile picture']: user.profile_picture,
  };
}

function toGalleryResponse(item) {
  return {
    id: item.id,
    url: item.url,
    uploadedAt: item.uploadedAt,
    label: item.label,
    isProfile: item.isProfile,
    userId: item.userId,
    recognizedUserIds: item.recognizedUserIds || [],
  };
}

module.exports = {
  toUserResponse,
  toGalleryResponse,
};
