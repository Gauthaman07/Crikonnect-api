const express = require('express');
const router = express.Router();
const { bookGround, updateBookingStatus, getUserBookings, getPendingGroundRequests, respondToGroundBookings } = require('../controllers/groundBookingController');
const authenticateUser = require('../middleware/authenticateUser');

// Changed from /ground/book to just /book since we're already in ground booking routes
router.post('/book', authenticateUser, bookGround);
router.post('/update-status/:bookingId', authenticateUser, updateBookingStatus);
router.get('/my-bookings', authenticateUser, getUserBookings);
router.get('/pending-requests', authenticateUser, getPendingGroundRequests);
router.post('/respond-to-requests', authenticateUser, respondToGroundBookings);

module.exports = router;