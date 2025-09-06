const express = require('express');
const router = express.Router();
const {
    requestGuestMatch,
    respondToGuestMatch,
    getPendingGuestRequests
} = require('../controllers/guestMatchController');
const authenticateUser = require('../middleware/authenticateUser');

// Request a guest match slot
router.post('/request', authenticateUser, requestGuestMatch);

// Approve or reject guest match request (ground owner only)
router.put('/respond/:requestId', authenticateUser, respondToGuestMatch);

// Get pending guest match requests for ground owner
router.get('/pending', authenticateUser, getPendingGuestRequests);

module.exports = router;