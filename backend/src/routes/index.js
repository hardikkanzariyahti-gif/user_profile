const express = require('express');
const userRoutes = require('./userRoutes');
const authRoutes = require('./authRoutes');
const galleryRoutes = require('./galleryRoutes');
const faceRoutes = require('./faceRoutes');

const router = express.Router();

router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/gallery', galleryRoutes);
router.use('/identify', faceRoutes);

module.exports = router;
