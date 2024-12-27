const express = require('express');
const router = express.Router();
const { bookGround, updateBookingStatus } = require('../controllers/groundBookingController');
const authenticateUser = require('../middleware/authenticateUser');

// Changed from /ground/book to just /book since we're already in ground booking routes
router.post('/book', authenticateUser, bookGround);
router.post('/update-status/:bookingId', authenticateUser, updateBookingStatus);

module.exports = router;