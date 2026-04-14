const fs = require('fs');
const path = require('path');
const faceAi = require('../../faceAi');
const { UPLOADS_DIR } = require('../config/constants');
const userRepository = require('../repositories/userRepository');
const { buildLabeledDescriptors } = require('./galleryService');

const faceService = {
  async identifyImage(filePath) {
    const users = await userRepository.findUsersWithProfilePicture();
    const labeledDescriptors = await buildLabeledDescriptors(users);

    if (labeledDescriptors.length === 0) {
      return { message: 'No known faces to compare with.' };
    }

    const matches = await faceAi.identifyAllFaces(filePath, labeledDescriptors);

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
      const matchedUser = await userRepository.findById(matchData.id);

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
      } else if (identifiedUsers.length > 1 && unknownCount === 0) {
        message = `Matches found: ${namesStr}!`;
      } else {
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
    return path.join(UPLOADS_DIR, filename);
  },

  fileExistsInUploads(url) {
    return fs.existsSync(this.resolveUploadedPath(url));
  },
};

module.exports = faceService;
