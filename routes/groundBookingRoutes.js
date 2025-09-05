const express = require('express');
const router = express.Router();
const { bookGround, updateBookingStatus, getUserBookings } = require('../controllers/groundBookingController');
const authenticateUser = require('../middleware/authenticateUser');

// Changed from /ground/book to just /book since we're already in ground booking routes
router.post('/book', authenticateUser, bookGround);
router.post('/update-status/:bookingId', authenticateUser, updateBookingStatus);
router.get('/my-bookings', authenticateUser, getUserBookings);

module.exports = router;