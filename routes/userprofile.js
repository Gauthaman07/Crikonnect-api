const express = require('express');
const router = express.Router();
const { getProfile } = require('../controllers/userController');
const authenticateUser = require('../middleware/authenticateUser');

router.get('/profile', authenticateUser, getProfile);

module.exports = router;