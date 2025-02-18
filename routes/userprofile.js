const express = require('express');
const router = express.Router();
const { getProfile } = require('../controllers/userController');
const authenticateUser = require('../middleware/authenticateUser');

// Use the getProfile function directly from the controller
router.get('/profile', authenticateUser, getProfile);

module.exports = router;