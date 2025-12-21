const express = require('express');
const router = express.Router();
const {
    requestGuestMatch,
    respondToGuestMatch,
    getPendingGuestRequests,
    getMyGuestRequests
} = require('../controllers/guestMatchController');
const authenticateUser = require('../middleware/authenticateUser');

// Request a guest match slot
router.post('/request', authenticateUser, requestGuestMatch);

// Approve or reject guest match request (ground owner only)
router.put('/respond/:requestId', authenticateUser, respondToGuestMatch);

// Get pending guest match requests for ground owner
router.get('/pending', authenticateUser, getPendingGuestRequests);

// Get user's guest match requests (My Bookings)
router.get('/my-bookings', authenticateUser, getMyGuestRequests);

module.exports = router;