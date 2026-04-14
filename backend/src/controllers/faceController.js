const fs = require('fs');
const faceService = require('../services/faceService');
const httpError = require('../utils/httpError');

const faceController = {
  async identify(req, res) {
    if (!req.file) {
      throw httpError(400, 'No image provided');
    }

    try {
      const result = await faceService.identifyImage(req.file.path);
      res.json(result);
    } finally {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  },
};

module.exports = faceController;
