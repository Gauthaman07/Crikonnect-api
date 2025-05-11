const express = require('express');
const router = express.Router();
const { getProfile,updateFcmToken  } = require('../controllers/userController');
const authenticateUser = require('../middleware/authenticateUser');

// Use the getProfile function directly from the controller
router.get('/profile', authenticateUser, getProfile);
router.post('/fcm-token', authenticateUser, updateFcmToken);

module.exports = router;