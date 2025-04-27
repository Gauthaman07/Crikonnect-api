const express = require('express');
const router = express.Router();
const authenticateUser = require('../middleware/authenticateUser');// Assuming you have this middleware
const { registerFCMToken, unregisterFCMToken, sendManualNotification } = require('../controllers/notificationController');

// Register FCM token
router.post('/register-token', authenticateUser, registerFCMToken);

// Unregister FCM token
router.delete('/unregister-token', authenticateUser, unregisterFCMToken);

// Send a manual notification (can add additional middleware for admin check)
router.post('/send', authenticateUser, sendManualNotification);

module.exports = router;