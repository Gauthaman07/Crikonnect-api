const express = require('express');
const router = express.Router();
const { createTournament, getTournamentsByLocation, registerForTournament } = require('../controllers/tournamentController');
const authenticateUser = require('../middleware/authenticateUser');

// Existing POST route for creating tournaments
router.post('/', authenticateUser, createTournament);

// Modified GET route to include authentication but make it optional
// This allows the route to access req.user when available without requiring authentication
router.get('/', authenticateUser, getTournamentsByLocation);

router.post('/register', authenticateUser, registerForTournament);

module.exports = router;