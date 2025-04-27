const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Assuming you have this middleware
const { registerFCMToken, unregisterFCMToken, sendManualNotification } = require('../controllers/notificationController');

// Register FCM token
router.post('/register-token', auth, registerFCMToken);

// Unregister FCM token
router.delete('/unregister-token', auth, unregisterFCMToken);

// Send a manual notification (can add additional middleware for admin check)
router.post('/send', auth, sendManualNotification);

module.exports = router;