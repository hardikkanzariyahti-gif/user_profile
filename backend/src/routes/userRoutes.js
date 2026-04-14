const express = require('express');
const upload = require('../config/upload');
const userController = require('../controllers/userController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/', asyncHandler(userController.create));
router.get('/', asyncHandler(userController.list));
router.get('/:id', asyncHandler(userController.getById));
router.put('/:id', upload.single('profilePicture'), asyncHandler(userController.update));
router.delete('/:id', asyncHandler(userController.remove));

module.exports = router;
