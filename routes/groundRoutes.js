const express = require('express');
const router = express.Router();
const { getAvailableGrounds } = require('../controllers/groundController');
const authenticateUser = require('../middleware/authenticateUser');

// GET: Fetch available grounds or bookings based on location
router.get('/', authenticateUser, getAvailableGrounds);

module.exports = router;
