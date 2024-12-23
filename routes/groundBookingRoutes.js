const express = require('express');
const router = express.Router();
const { bookGround } = require('../controllers/groundBookingController');
const authenticateUser = require('../middleware/authenticateUser');

// Changed from /ground/book to just /book since we're already in ground booking routes
router.post('ground//book', authenticateUser, bookGround);

module.exports = router;