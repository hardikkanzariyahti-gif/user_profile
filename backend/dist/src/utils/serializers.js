"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUserResponse = toUserResponse;
exports.toGalleryResponse = toGalleryResponse;
const constants_1 = require("../config/constants");
function fixUrlPort(url) {
    if (!url)
        return url;
    // If the stored URL is localhost:4000 but we are now on another port, fix it.
    return url.replace('http://localhost:4000', constants_1.APP_BASE_URL);
}
function toUserResponse(user) {
    const profilePicture = fixUrlPort(user.profile_picture);
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: profilePicture,
        ['profile picture']: profilePicture,
    };
}
function toGalleryResponse(item) {
    return {
        id: item.id,
        url: fixUrlPort(item.url),
        uploadedAt: item.uploadedAt,
        label: item.label,
        isProfile: item.isProfile,
        userId: item.userId,
        recognizedUserIds: item.recognizedUserIds || [],
        // Enrich recognizedUsers with profilePicture so UI avatars work in tags
        recognizedUsers: (item.recognizedUsers || []).map((u) => ({
            id: u.id,
            name: u.name,
            profilePicture: fixUrlPort(u.profile_picture || u.profilePicture) || null,
        })),
    };
}
//# sourceMappingURL=serializers.js.map