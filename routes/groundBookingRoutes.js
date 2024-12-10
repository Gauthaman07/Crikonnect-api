const express = require('express');
const router = express.Router();
const { bookGround } = require('../controllers/groundBookingController');

router.post('/ground/book', bookGround);

module.exports = router;
