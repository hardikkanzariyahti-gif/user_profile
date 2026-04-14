const { galleryService } = require('../services/galleryService');

const galleryController = {
  async list(req, res) {
    const gallery = await galleryService.listGallery(req.query.userId);
    res.json(gallery);
  },

  async upload(req, res) {
    const gallery = await galleryService.uploadGallery(req.files || [], req.query.userId);
    res.json(gallery);
  },
};

module.exports = galleryController;
