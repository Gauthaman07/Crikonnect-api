const express = require('express');
const { createTeam } = require('../controllers/teamController');
const router = express.Router();

// Route to create a new team
router.post('/create', createTeam);

module.exports = router;
