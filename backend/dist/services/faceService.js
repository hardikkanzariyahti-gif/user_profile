"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const faceAi_1 = __importDefault(require("../../faceAi"));
const constants_1 = require("../config/constants");
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const galleryService_1 = require("./galleryService");
const faceService = {
    async identifyImage(filePath) {
        const users = await userRepository_1.default.findUsersWithProfilePicture();
        const labeledDescriptors = await (0, galleryService_1.buildLabeledDescriptors)(users);
        if (labeledDescriptors.length === 0) {
            return { message: 'No known faces to compare with.' };
        }
        const matches = await faceAi_1.default.identifyAllFaces(filePath, labeledDescriptors);
        if (!matches || matches.length === 0) {
            return { message: 'No faces found in the image.' };
        }
        const identifiedUsers = [];
        let unknownCount = 0;
        let matchIndex = 0;
        for (const match of matches) {
            if (match.label === 'unknown') {
                unknownCount += 1;
                continue;
            }
            const matchData = JSON.parse(match.label);
            const matchedUser = await userRepository_1.default.findById(matchData.id);
            if (matchedUser) {
                identifiedUsers.push({
                    id: `${matchedUser.id}_${matchIndex++}`,
                    originalId: matchedUser.id,
                    name: matchedUser.name,
                    email: matchedUser.email,
                    profilePicture: matchedUser.profile_picture,
                    ['profile picture']: matchedUser.profile_picture,
                    confidence: Number((1 - match.distance).toFixed(2)),
                });
            }
        }
        if (identifiedUsers.length > 0) {
            const uniqueNames = [...new Set(identifiedUsers.map((u) => u.name))];
            const namesStr = uniqueNames.join(' and ');
            let message = '';
            if (identifiedUsers.length === 1 && unknownCount === 0) {
                message = `Match found: This is ${namesStr}!`;
            }
            else if (identifiedUsers.length > 1 && unknownCount === 0) {
                message = `Matches found: ${namesStr}!`;
            }
            else {
                message = `Matches found for ${namesStr}, and ${unknownCount} person(s) unrecognized.`;
            }
            return {
                message,
                users: identifiedUsers,
                unknownCount,
            };
        }
        return { message: `Found ${unknownCount} unrecognized person(s).` };
    },
    resolveUploadedPath(url) {
        const filename = url.split('/').pop();
        return path.join(constants_1.UPLOADS_DIR, filename);
    },
    fileExistsInUploads(url) {
        return require('fs').existsSync(this.resolveUploadedPath(url));
    },
};
exports.default = faceService;
//# sourceMappingURL=faceService.js.map