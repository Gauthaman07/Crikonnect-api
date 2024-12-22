const express = require('express');
const { getProfile } = require('../controllers/userController');
const authenticateUser = require('../middleware/authenticateUser');
const router = express.Router();

router.get('/profile', authenticateUser, getProfile);

module.exports = router;