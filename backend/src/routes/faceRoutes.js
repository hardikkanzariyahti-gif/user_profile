const express = require('express');
const upload = require('../config/upload');
const faceController = require('../controllers/faceController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/', upload.single('image'), asyncHandler(faceController.identify));

module.exports = router;
