const express = require('express');
const upload = require('../config/upload');
const galleryController = require('../controllers/galleryController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(galleryController.list));
router.post('/', upload.array('gallery', 10), asyncHandler(galleryController.upload));

module.exports = router;
