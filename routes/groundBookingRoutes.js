const express = require('express');
const router = express.Router();
const { bookGround } = require('../controllers/groundBookingController');
const authenticateUser = require('../middleware/authenticateUser');

router.post('/ground/book', authenticateUser, bookGround);

module.exports = router;
