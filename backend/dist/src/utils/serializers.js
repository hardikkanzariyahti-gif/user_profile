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
    const profilePictures = Array.isArray(user.profile_pictures)
        ? user.profile_pictures.map((u) => fixUrlPort(u)).filter(Boolean)
        : [];
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePicture: profilePicture,
        profilePictures,
        ['profile picture']: profilePicture,
        ['profile pictures']: profilePictures,
    };
}
function toGalleryResponse(item) {
    const dbMeta = item.metadata || {};
    const raw = (dbMeta.rawJson || {});
    // 1. Resolve array collections resiliently across iterations (Requirement 5 & 8)
    const cleanObjects = (Array.isArray(dbMeta.objects) && dbMeta.objects.length > 0)
        ? dbMeta.objects
        : (Array.isArray(dbMeta.detectedObjects) && dbMeta.detectedObjects.length > 0)
            ? dbMeta.detectedObjects
            : (raw.objects || []);
    const cleanScenes = (Array.isArray(dbMeta.scenes) && dbMeta.scenes.length > 0)
        ? dbMeta.scenes
        : (Array.isArray(dbMeta.scene) && dbMeta.scene.length > 0)
            ? dbMeta.scene
            : (raw.scenes || []);
    const cleanOcr = (Array.isArray(dbMeta.ocrText) && dbMeta.ocrText.length > 0)
        ? dbMeta.ocrText
        : (Array.isArray(dbMeta.ocrTextJson) && dbMeta.ocrTextJson.length > 0)
            ? dbMeta.ocrTextJson
            : (raw.ocrText || []);
    const combinedHashtags = Array.isArray(item.hashtags)
        ? item.hashtags.map((h) => typeof h === 'string' ? h : h.name)
        : (Array.isArray(dbMeta.hashtags) ? dbMeta.hashtags : []);
    // 2. Standardized Metadata Shape Mapping (Requirement 5)
    const metadata = {
        // Primary First-Class mappings:
        description: dbMeta.description || raw.caption || raw.description || "",
        aiSummary: dbMeta.aiSummary || raw.caption || raw.aiSummary || "",
        scene: cleanScenes.map((s) => typeof s === 'string' ? s : (s.label || '')).filter(Boolean).join(', '),
        detectedObjects: cleanObjects.map((o) => typeof o === 'string' ? o : (o.name || '')).filter(Boolean).join(', '),
        hashtags: combinedHashtags,
        ocrText: cleanOcr,
        peopleCount: dbMeta.peopleCount ?? dbMeta.personCount ?? raw.person_count ?? 0,
        eventName: dbMeta.eventName || raw.customEvent || raw.eventName || "",
        location: dbMeta.location || raw.customLocation || raw.location || "",
        dominantColor: dbMeta.dominantColor || raw.dominant_color || null,
        aspectRatio: dbMeta.aspectRatio || raw.aspect_ratio || null,
        customDetails: {
            dominant_color: dbMeta.dominantColor || raw.dominant_color || null,
            aspect_ratio: dbMeta.aspectRatio || raw.aspect_ratio || null,
            orientation: dbMeta.orientation || raw.orientation || null,
            generatedAt: dbMeta.generatedAt || raw.metadataGeneratedAt || null,
            metadataVersion: dbMeta.metadataVersion || 1,
        },
        // Backward compatibility fallback overrides:
        objects: cleanObjects,
        scenes: cleanScenes,
        caption: dbMeta.description || raw.caption || "",
        person_count: dbMeta.peopleCount ?? dbMeta.personCount ?? raw.person_count ?? 0,
        dominant_color: dbMeta.dominantColor || raw.dominant_color || null,
        aspect_ratio: dbMeta.aspectRatio || raw.aspect_ratio || null,
        orientation: dbMeta.orientation || raw.orientation || null,
        customLocation: dbMeta.location || raw.customLocation || "",
        customEvent: dbMeta.eventName || raw.customEvent || "",
        lastScanError: dbMeta.lastScanError || raw.lastScanError || null,
        lastMetaError: dbMeta.lastMetaError || raw.lastMetaError || null,
    };
    const fullUrl = fixUrlPort(item.url);
    let thumbUrl = fullUrl;
    if (item.url) {
        const base = item.url.split('/').pop() || '';
        const cleanName = base.replace(/\.[a-z0-9]+$/i, '');
        const staticBase = fullUrl?.substring(0, fullUrl.lastIndexOf('/') + 1) || '';
        thumbUrl = `${staticBase}thumbs/${cleanName}_400.jpg`;
    }
    return {
        id: item.id,
        url: fullUrl,
        thumbnailUrl: thumbUrl,
        uploadedAt: item.uploadedAt,
        label: item.label,
        isProfile: item.isProfile,
        userId: item.userId,
        // Required Serialized Signature (Requirement 5)
        metadata,
        people: (item.recognizedUsers || []).map((u) => ({
            id: u.id,
            name: u.name,
            profilePicture: fixUrlPort(u.profile_picture || u.profilePicture) || null,
        })),
        scanStatus: item.scanStatus || 'pending',
        metadataStatus: item.metadataStatus || 'pending',
        lastScanError: dbMeta.lastScanError || raw.lastScanError || null,
        lastMetaError: dbMeta.lastMetaError || raw.lastMetaError || null,
        // Extra continuity aliases:
        recognizedUserIds: item.recognizedUserIds || [],
        hashtags: combinedHashtags,
        objectTags: cleanObjects,
        sceneTags: cleanScenes,
        ocrText: cleanOcr,
        faces: Array.isArray(item.faceDescriptors)
            ? item.faceDescriptors.map((f, i) => {
                const manualUserId = f.manuallyTaggedUserId ? Number(f.manuallyTaggedUserId) : null;
                let pId = manualUserId || f.personId || null;
                let pName = f.personName || null;
                if (manualUserId && !pName) {
                    const matchedUser = (item.recognizedUsers || []).find((u) => Number(u.id) === Number(manualUserId));
                    if (matchedUser)
                        pName = matchedUser.name;
                }
                return {
                    faceId: `face_${item.id}_${i}`,
                    box: f.box,
                    expandedBox: f.expandedBox || f.box,
                    personId: pId,
                    personName: pName,
                    similarity: f.similarity ?? (manualUserId ? 1.0 : 0.0),
                    status: manualUserId ? 'recognized' : (f.status || 'unknown'),
                    confidence: f.confidence || (manualUserId ? 100 : 0),
                    reason: manualUserId ? 'manual_tagged' : (f.reason || 'not_matched')
                };
            })
            : [],
        recognizedUsers: (item.recognizedUsers || []).map((u) => ({
            id: u.id,
            name: u.name,
            profilePicture: fixUrlPort(u.profile_picture || u.profilePicture) || null,
        })),
    };
}
//# sourceMappingURL=serializers.js.map